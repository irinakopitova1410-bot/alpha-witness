import type { CaseClassification, VerdictRecord } from './contracts';

export function makeVerdict(classification: CaseClassification, evidenceCount: number, claimsAvailable: boolean): VerdictRecord {
  const gates = [
    { name: 'Independent, reproducible source evidence', passed: evidenceCount > 0, detail: evidenceCount > 0 ? 'At least one provenance-backed source is present.' : 'No source evidence is available.' },
    { name: 'Structured claim analysis', passed: claimsAvailable, detail: claimsAvailable ? 'Claims were returned by a configured analysis provider.' : 'No provider-backed claim analysis is available.' },
    { name: 'Complete ledger / market validation', passed: false, detail: 'Not available in the initial MVP.' },
    { name: 'Pre-authorized paper-test protocol', passed: false, detail: 'Automatic authorization is disabled by design.' }
  ];
  const allStrictGates = gates.every((gate) => gate.passed);
  if (allStrictGates && classification === 'ASSET') return { decision: 'PAPER_TEST', rationale: 'Strict evidence gates passed.', availability: 'AVAILABLE', gates };
  if (!claimsAvailable || evidenceCount === 0) return { decision: evidenceCount > 0 ? 'WATCH' : 'VETO', rationale: evidenceCount > 0 ? 'Evidence exists, but analysis is incomplete; monitor only.' : 'No usable evidence was acquired; do not trade or paper test.', availability: claimsAvailable ? 'AVAILABLE' : 'ANALYSIS_TEMPORARILY_UNAVAILABLE', gates };
  return { decision: 'VETO', rationale: 'Evidence gates are incomplete. No trade or paper test is authorized.', availability: 'AVAILABLE', gates };
}
