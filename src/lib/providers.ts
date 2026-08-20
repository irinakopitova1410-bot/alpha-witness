import type { Availability, Claim, EvidenceItem } from './contracts';
import { rateLimit } from './rateLimit';

export interface ClaimAnalysisProvider { analyze(input: { classification: string; evidence: EvidenceItem[]; clientKey?: string }): Promise<{ claims: Claim[]; availability: Availability }>; }
export interface MarketDataProvider { lookup(symbol: string): Promise<{ availability: Availability; evidence?: EvidenceItem }>; }

const PROVIDER_TIMEOUT_MS = 12_000;
function provenance(note: string) { return { sourceType: 'USER_INPUT' as const, retrievedAt: new Date().toISOString(), note }; }

function validClaim(rawClaim: unknown, index: number, evidence: EvidenceItem[]): Claim | null {
  if (!rawClaim || typeof rawClaim !== 'object') return null;
  const item = rawClaim as Record<string, unknown>;
  const statement = typeof item.statement === 'string' ? item.statement : '';
  if (!statement.trim()) return null;
  const evidenceId = typeof item.evidenceId === 'string' ? item.evidenceId : Array.isArray(item.evidenceIds) && item.evidenceIds.length === 1 && typeof item.evidenceIds[0] === 'string' ? item.evidenceIds[0] : '';
  const evidenceItem = evidence.find((candidate) => candidate.id === evidenceId);
  if (!evidenceItem) return null;
  const quotations = Array.isArray(item.quotations) ? item.quotations : typeof item.quotation === 'string' ? [item.quotation] : [];
  if (!quotations.length || quotations.some((quote) => typeof quote !== 'string' || !quote.trim() || !evidenceItem.content.includes(quote))) return null;
  const status = item.status === 'OBSERVED' || item.status === 'ASSERTED' || item.status === 'INFERRED' ? item.status : 'ASSERTED';
  // Preserve each accepted quotation exactly as returned; validation does not trim or rewrite it.
  return { id: `claim-${index + 1}`, statement, status, availability: 'AVAILABLE', quotations: quotations as string[], evidenceIds: [evidenceId], provenance: [evidenceItem.provenance] };
}

export class GeminiProvider implements ClaimAnalysisProvider {
  constructor(private readonly apiKey: string, private readonly model = process.env.GEMINI_MODEL || 'gemini-2.0-flash') {}
  async analyze(input: { classification: string; evidence: EvidenceItem[]; clientKey?: string }): Promise<{ claims: Claim[]; availability: Availability }> {
    const limited = rateLimit('gemini', input.clientKey || 'unknown', 12, 10 * 60_000);
    if (!limited.allowed) return { claims: [], availability: 'PARTIAL_ANALYSIS' };
    const evidenceText = input.evidence.filter((item) => item.availability === 'AVAILABLE').map((item) => `[${item.id}] ${item.content.slice(0, 10_000)}`).join('\n');
    const prompt = `You are AI HORIZON — WITNESS AI Engine, an evidence analysis engine. Return ONLY valid JSON: {"claims":[{"statement":"...","status":"OBSERVED|ASSERTED|INFERRED","quotations":["exact quote from evidence"],"evidenceId":"id"}]}. Use only the evidence below. Every claim must use exactly one known evidenceId and have one or more non-empty quotations copied verbatim from that exact evidence item, or return no claim. Never fabricate facts, sources, prices, dates, or quotations. If evidence is insufficient, return an empty claims array. Classification: ${input.classification}\nEvidence:\n${evidenceText}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }), signal: controller.signal });
      if (!response.ok) return { claims: [], availability: 'ANALYSIS_TEMPORARILY_UNAVAILABLE' };
      const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const raw = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) return { claims: [], availability: 'NON_AVAILABLE' };
      let parsed: { claims?: unknown };
      try { parsed = JSON.parse(raw) as { claims?: unknown }; }
      catch { return { claims: [], availability: 'PARTIAL_ANALYSIS' }; }
      if (!Array.isArray(parsed.claims)) return { claims: [], availability: 'NON_AVAILABLE' };
      const claims = parsed.claims.flatMap((claim, index) => { const valid = validClaim(claim, index, input.evidence); return valid ? [valid] : []; });
      if (!claims.length) return { claims, availability: parsed.claims.length ? 'PARTIAL_ANALYSIS' : 'NON_AVAILABLE' };
      return { claims, availability: claims.length === parsed.claims.length ? 'AVAILABLE' : 'PARTIAL_ANALYSIS' };
    } catch {
      return { claims: [], availability: 'ANALYSIS_TEMPORARILY_UNAVAILABLE' };
    } finally { clearTimeout(timer); }
  }
}
export class UnavailableMarketDataProvider implements MarketDataProvider { async lookup(_symbol: string) { return { availability: 'NON_AVAILABLE' as const }; } }
export function getClaimProvider(): ClaimAnalysisProvider | null { return process.env.GEMINI_API_KEY ? new GeminiProvider(process.env.GEMINI_API_KEY) : null; }
export function unavailableClaimResult() { return { claims: [] as Claim[], availability: 'ANALYSIS_TEMPORARILY_UNAVAILABLE' as Availability, provenance: provenance('No AI provider key configured; analysis was not generated.') }; }
export const validateGeminiClaim = validClaim;
