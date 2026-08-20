import test from 'node:test';
import assert from 'node:assert/strict';
import { publicCase } from '../src/lib/repository';
import type { CaseFile } from '../src/lib/contracts';

const fixture: CaseFile = { id: 'AW-abcdefghijklmnop', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', input: { kind: 'pdf', label: 'proof.pdf' }, classification: 'PAPER', status: 'PARTIAL', title: 'proof.pdf', shareable: true, evidenceLedger: [{ id: 'pdf-1', kind: 'SOURCE', title: 'proof.pdf', content: 'JVBERi0xLjQgbm90LXNhZmU=', availability: 'NON_AVAILABLE', provenance: { sourceType: 'PDF', retrievedAt: '2026-01-01T00:00:00.000Z' }, hash: 'hash' }], claims: [], verdict: { decision: 'WATCH', rationale: 'Incomplete.', availability: 'NON_AVAILABLE', gates: [] }, notebook: { overview: '', method: '', openQuestions: [] } };

test('public serialization omits private/raw input fields and PDF payloads', () => {
  const legacy = { ...fixture, input: { ...fixture.input, value: 'raw hidden input' }, privateNotes: [{ body: 'secret', updatedAt: 'now' }] } as unknown as CaseFile;
  const serialized = publicCase(legacy) as unknown as Record<string, unknown>;
  assert.equal('privateNotes' in serialized, false);
  assert.deepEqual(serialized.input, { kind: 'pdf', label: 'proof.pdf' });
  assert.doesNotMatch(JSON.stringify(serialized), /JVBERi0xLjQ|secret|raw hidden input/);
});
