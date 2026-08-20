import crypto from 'node:crypto';
import type { Availability, CaseFile, CreateInput, EvidenceItem, Provenance } from './contracts';
import { MAX_PDF_BYTES } from './contracts';
import { classifyInput } from './classifier';
import { fetchPublicUrl } from './ssrf';
import { bytesToText, htmlTitle, htmlToText } from './extract';
import { getClaimProvider, unavailableClaimResult } from './providers';
import { makeVerdict } from './verdict';
import { getCaseRepository } from './repositoryFactory';

const now = () => new Date().toISOString();
const id = () => `AW-${crypto.randomBytes(18).toString('base64url')}`;
function provenance(sourceType: Provenance['sourceType'], extra: Partial<Provenance> = {}): Provenance { return { sourceType, retrievedAt: now(), ...extra }; }
function sourceEvidence(content: string, p: Provenance, title: string): EvidenceItem { return { id: `evidence-${crypto.randomBytes(8).toString('hex')}`, kind: 'SOURCE', title, content: content.slice(0, 200_000), availability: 'AVAILABLE', provenance: p, hash: crypto.createHash('sha256').update(content).digest('hex') }; }

export function robotsAllowsPath(robotsText: string, pathname: string, userAgent = 'alphawitness'): boolean {
  type Group = { agents: string[]; disallow: string[] };
  const groups: Group[] = []; let current: Group | undefined;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split('#', 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(':'); if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase(); const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (!current || current.disallow.length) { current = { agents: [], disallow: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
    } else if (key === 'disallow' && current && value) current.disallow.push(value);
  }
  const normalizedAgent = userAgent.toLowerCase();
  const exact = groups.filter((group) => group.agents.includes(normalizedAgent));
  const applicable = exact.length ? exact : groups.filter((group) => group.agents.includes('*'));
  return !applicable.some((group) => group.disallow.some((rule) => pathname.startsWith(rule)));
}

async function assertRobotsAllowed(sourceUrl: string): Promise<void> {
  const source = new URL(sourceUrl);
  try {
    const robots = await fetchPublicUrl(`${source.origin}/robots.txt`, { accept: 'text/plain' });
    if (!['text/plain', 'text/html', 'application/octet-stream'].includes(robots.contentType)) return;
    if (!robotsAllowsPath(bytesToText(robots.bytes), source.pathname)) throw new Error('ROBOTS_DISALLOWS_FETCH');
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'SOURCE_HTTP_404') return;
    if (error instanceof Error && error.message === 'ROBOTS_DISALLOWS_FETCH') throw error;
    throw new Error('ROBOTS_OR_ACCESS_UNAVAILABLE');
  }
}

async function acquire(input: CreateInput): Promise<{ title: string; evidence: EvidenceItem[] }> {
  if (input.kind === 'text' || input.kind === 'name' || input.kind === 'ticker') {
    const title = input.label || input.value.trim().slice(0, 120) || 'Untitled input';
    return { title, evidence: [sourceEvidence(input.value, provenance('USER_INPUT', { note: `Guest ${input.kind}; no external verification performed.` }), title)] };
  }
  if (input.kind === 'pdf') {
    const bytes = Buffer.from(input.value, 'base64');
    if (bytes.length < 5 || bytes.length > MAX_PDF_BYTES || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('INVALID_PDF');
    const title = input.label || 'Uploaded PDF';
    return { title, evidence: [{ id: `evidence-${crypto.randomBytes(8).toString('hex')}`, kind: 'SOURCE', title, content: 'PDF text extraction: NON_AVAILABLE. No claims were generated from this file.', availability: 'NON_AVAILABLE', provenance: provenance('PDF', { contentType: 'application/pdf', title, note: 'PDF metadata and SHA-256 were recorded; bytes are not persisted.' }), hash: crypto.createHash('sha256').update(bytes).digest('hex') }] };
  }
  await assertRobotsAllowed(input.value);
  const fetched = await fetchPublicUrl(input.value);
  if (!['text/html', 'application/xhtml+xml', 'application/pdf', 'text/plain'].includes(fetched.contentType)) throw new Error(`UNSUPPORTED_CONTENT_TYPE_${fetched.contentType || 'missing'}`);
  const finalUrl = fetched.url;
  const isYouTube = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(new URL(finalUrl).hostname);
  if (isYouTube) {
    let title: string | undefined; let note = 'YouTube transcript: NON_AVAILABLE unless a legal public transcript endpoint succeeds.';
    try { const oembed = await fetchPublicUrl(`https://www.youtube.com/oembed?url=${encodeURIComponent(finalUrl)}&format=json`, { accept: 'application/json' }); const parsed = JSON.parse(bytesToText(oembed.bytes)) as { title?: string; author_name?: string }; title = parsed.title; note = `YouTube oEmbed metadata acquired${parsed.author_name ? `; author: ${parsed.author_name}` : ''}. ${note}`; }
    catch { note = `YouTube oEmbed metadata unavailable. ${note}`; }
    const content = title ? `YouTube title: ${title}\n${note}` : note;
    return { title: title || 'YouTube source', evidence: [sourceEvidence(content, provenance('YOUTUBE_OEMBED', { sourceUrl: finalUrl, title, note }), title || 'YouTube source')] };
  }
  if (fetched.contentType === 'application/pdf') return { title: 'PDF source', evidence: [{ ...sourceEvidence('', provenance('PDF', { sourceUrl: finalUrl, contentType: fetched.contentType, note: 'PDF extraction: NON_AVAILABLE in this MVP.' }), 'PDF source'), availability: 'NON_AVAILABLE', content: 'PDF text extraction: NON_AVAILABLE. No claims were generated from this file.' }] };
  const raw = bytesToText(fetched.bytes); const content = fetched.contentType === 'text/html' || fetched.contentType === 'application/xhtml+xml' ? htmlToText(raw) : raw;
  if (!content) throw new Error('EMPTY_SOURCE_TEXT');
  const title = htmlTitle(raw) || new URL(finalUrl).hostname;
  return { title, evidence: [sourceEvidence(content, provenance('URL', { sourceUrl: finalUrl, contentType: fetched.contentType, title, note: 'Fetched after hostname and reserved-address checks. DNS rebinding cannot be fully prevented by this runtime.' }), title)] };
}

function acquisitionAvailability(message: string): Availability {
  if (message.startsWith('BLOCKED_') || message === 'ROBOTS_DISALLOWS_FETCH') return 'BLOCKED';
  if (message === 'INVALID_PDF') return 'NON_AVAILABLE';
  return 'SOURCE_ACCESS_FAILED';
}

export async function createAndProcessCase(input: CreateInput, options: { clientKey?: string } = {}): Promise<CaseFile> {
  const created = now();
  const caseFile: CaseFile = { id: id(), createdAt: created, updatedAt: created, input: { kind: input.kind, ...(input.label ? { label: input.label } : {}) }, classification: classifyInput(input.value, input.label), status: 'QUEUED', title: input.label || 'Untitled case', shareable: true, evidenceLedger: [], claims: [], verdict: makeVerdict('UNKNOWN', 0, false), notebook: { overview: 'No provider-backed analysis has been produced.', method: 'Acquisition and classification are deterministic. Claim analysis requires a configured provider.', openQuestions: [] } };
  const repository = await getCaseRepository();
  await repository.put(caseFile);
  try {
    caseFile.status = 'ACQUIRING'; caseFile.updatedAt = now(); await repository.put(caseFile);
    const acquired = await acquire(input); caseFile.title = acquired.title; caseFile.evidenceLedger = acquired.evidence;
    caseFile.status = 'ANALYZING'; caseFile.updatedAt = now(); await repository.put(caseFile);
    const provider = getClaimProvider();
    const result = provider && caseFile.evidenceLedger.some((item) => item.availability === 'AVAILABLE') ? await provider.analyze({ classification: caseFile.classification, evidence: caseFile.evidenceLedger, clientKey: options.clientKey }) : unavailableClaimResult();
    caseFile.claims = result.claims;
    caseFile.verdict = makeVerdict(caseFile.classification, caseFile.evidenceLedger.filter((item) => item.availability === 'AVAILABLE').length, result.claims.length > 0);
    if (!result.claims.length) caseFile.verdict.availability = result.availability;
    caseFile.status = result.claims.length ? 'COMPLETE' : 'PARTIAL';
    caseFile.notebook = { overview: result.claims.length ? 'Provider-backed claims are linked to exact quoted evidence.' : `Claim analysis status: ${result.availability}. No synthetic claims were created.`, method: 'Deterministic intake → provenance capture → classification → optional provider analysis → conservative verdict gates.', openQuestions: ['Can the claims be independently reproduced?', 'Is complete market or transaction data available?', 'Are conflicts and incentives fully disclosed?'] };
    caseFile.updatedAt = now(); await repository.put(caseFile); return caseFile;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'ACQUISITION_FAILED';
    caseFile.status = 'FAILED'; caseFile.error = message;
    if (!caseFile.evidenceLedger.length) caseFile.evidenceLedger = [{ id: `evidence-failure-${crypto.randomBytes(8).toString('hex')}`, kind: 'SOURCE', title: 'Acquisition result', content: `Source acquisition: ${acquisitionAvailability(message)}.`, availability: acquisitionAvailability(message), provenance: provenance(input.kind === 'url' ? 'URL' : input.kind === 'pdf' ? 'PDF' : 'USER_INPUT', { sourceUrl: input.kind === 'url' ? input.value : undefined, note: 'Failure captured without inventing source facts.' }) }];
    caseFile.verdict = makeVerdict(caseFile.classification, 0, false); caseFile.updatedAt = now(); await repository.put(caseFile); return caseFile;
  }
}
