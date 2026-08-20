export type CaseClassification = 'VIDEO' | 'NEWS_POST' | 'PAPER' | 'TRADER_PERSONA' | 'ASSET' | 'UNKNOWN';
export type CaseStatus = 'QUEUED' | 'ACQUIRING' | 'ANALYZING' | 'PARTIAL' | 'COMPLETE' | 'FAILED';
export type Availability = 'AVAILABLE' | 'NON_AVAILABLE' | 'ANALYSIS_TEMPORARILY_UNAVAILABLE' | 'SOURCE_ACCESS_FAILED' | 'PARTIAL_ANALYSIS' | 'BLOCKED' | 'NOT_APPLICABLE';
export type Verdict = 'WATCH' | 'VETO' | 'PAPER_TEST';

export const MAX_PDF_BYTES = 2_000_000;

export interface Provenance {
  sourceType: 'USER_INPUT' | 'URL' | 'PDF' | 'YOUTUBE_OEMBED' | 'ARCHIVE';
  sourceUrl?: string;
  retrievedAt: string;
  contentType?: string;
  title?: string;
  note?: string;
}

export interface EvidenceItem {
  id: string;
  kind: 'SOURCE' | 'EXTRACT' | 'MARKET_DATA' | 'CONTEXT';
  title: string;
  content: string;
  availability: Availability;
  provenance: Provenance;
  hash?: string;
}

export interface Claim {
  id: string;
  statement: string;
  status: 'OBSERVED' | 'ASSERTED' | 'INFERRED';
  availability: Availability;
  quotations: string[];
  evidenceIds: string[];
  provenance: Provenance[];
  caveat?: string;
}

export interface VerdictRecord {
  decision: Verdict;
  rationale: string;
  availability: Availability;
  gates: { name: string; passed: boolean; detail: string }[];
}

export interface Notebook {
  overview: string;
  method: string;
  openQuestions: string[];
}

export type InputKind = 'url' | 'text' | 'name' | 'ticker' | 'pdf';
export interface StoredInput { kind: InputKind; label?: string; }
export interface CreateInput { kind: InputKind; value: string; label?: string; }

/** Persisted cases intentionally do not contain private notes or uploaded file bytes. */
export interface CaseFile {
  id: string;
  createdAt: string;
  updatedAt: string;
  input: StoredInput;
  classification: CaseClassification;
  status: CaseStatus;
  title: string;
  shareable: boolean;
  archived?: boolean;
  evidenceLedger: EvidenceItem[];
  claims: Claim[];
  verdict: VerdictRecord;
  notebook: Notebook;
  error?: string;
}
