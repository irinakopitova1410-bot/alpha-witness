import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeminiClaim } from '../src/lib/providers';
import type { EvidenceItem } from '../src/lib/contracts';

const evidence: EvidenceItem[] = [
  { id: 'evidence-a', kind: 'SOURCE', title: 'A', content: 'Exact evidence quotation.', availability: 'AVAILABLE', provenance: { sourceType: 'URL', retrievedAt: '2026-01-01T00:00:00.000Z' } },
  { id: 'evidence-b', kind: 'SOURCE', title: 'B', content: 'Different text.', availability: 'AVAILABLE', provenance: { sourceType: 'URL', retrievedAt: '2026-01-01T00:00:00.000Z' } }
];

test('Gemini validation rejects empty quotations and empty statements', () => {
  assert.equal(validateGeminiClaim({ statement: 'Claim', evidenceId: 'evidence-a', quotations: ['   '] }, 0, evidence), null);
  assert.equal(validateGeminiClaim({ statement: '  ', evidenceId: 'evidence-a', quotations: ['Exact evidence quotation.'] }, 0, evidence), null);
});
test('Gemini validation rejects unknown or wrong-evidence quotations', () => {
  assert.equal(validateGeminiClaim({ statement: 'Claim', evidenceId: 'missing', quotations: ['Exact evidence quotation.'] }, 0, evidence), null);
  assert.equal(validateGeminiClaim({ statement: 'Claim', evidenceId: 'evidence-b', quotations: ['Exact evidence quotation.'] }, 0, evidence), null);
  const accepted = validateGeminiClaim({ statement: 'Claim', evidenceId: 'evidence-a', quotations: ['Exact evidence quotation.'] }, 0, evidence);
  assert.equal(accepted?.quotations[0], 'Exact evidence quotation.');
});
