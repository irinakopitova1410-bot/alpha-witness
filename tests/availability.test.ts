import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiProvider } from '../src/lib/providers';
import type { EvidenceItem } from '../src/lib/contracts';

const evidence: EvidenceItem[] = [{ id: 'evidence-a', kind: 'SOURCE', title: 'A', content: 'Evidence.', availability: 'AVAILABLE', provenance: { sourceType: 'URL', retrievedAt: '2026-01-01T00:00:00.000Z' } }];
test('invalid provider claims are reported as partial analysis rather than accepted', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ claims: [{ statement: 'Claim', evidenceId: 'wrong', quotations: ['Evidence.'] }] }) }] } }] }), { status: 200 });
  try { const result = await new GeminiProvider('test').analyze({ classification: 'UNKNOWN', evidence, clientKey: 'test' }); assert.equal(result.availability, 'PARTIAL_ANALYSIS'); assert.equal(result.claims.length, 0); }
  finally { globalThis.fetch = originalFetch; }
});
