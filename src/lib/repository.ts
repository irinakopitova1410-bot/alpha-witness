import type { CaseFile, Claim, EvidenceItem, Notebook, StoredInput, VerdictRecord } from './contracts';

export interface CaseRepository {
  get(id: string): Promise<CaseFile | null>;
  put(caseFile: CaseFile): Promise<void>;
}

export interface PublicCase {
  id: string;
  createdAt: string;
  updatedAt: string;
  input: StoredInput;
  classification: CaseFile['classification'];
  status: CaseFile['status'];
  title: string;
  shareable: true;
  archived?: boolean;
  evidenceLedger: EvidenceItem[];
  claims: Claim[];
  verdict: VerdictRecord;
  notebook: Notebook;
  error?: string;
}

/** Explicit allow-list serialization; persistence-only fields can never leak by spreading a case object. */
export function publicCase(caseFile: CaseFile): PublicCase {
  const evidenceLedger = caseFile.evidenceLedger.map((item) => ({
    id: item.id, kind: item.kind, title: item.title,
    // PDF bytes are never persisted or returned. Defend against legacy rows as well.
    content: item.provenance.sourceType === 'PDF' ? 'PDF text extraction: NON_AVAILABLE. No claims were generated from this file.' : item.content,
    availability: item.availability, provenance: item.provenance, ...(item.hash ? { hash: item.hash } : {})
  }));
  return {
    id: caseFile.id, createdAt: caseFile.createdAt, updatedAt: caseFile.updatedAt,
    input: { kind: caseFile.input.kind, ...(caseFile.input.label ? { label: caseFile.input.label } : {}) },
    classification: caseFile.classification, status: caseFile.status, title: caseFile.title, shareable: true,
    ...(caseFile.archived ? { archived: true } : {}), evidenceLedger, claims: caseFile.claims, verdict: caseFile.verdict, notebook: caseFile.notebook,
    ...(caseFile.error ? { error: caseFile.error } : {})
  };
}

export function isPublicGuestCase(caseFile: CaseFile | null): caseFile is CaseFile {
  return Boolean(caseFile && caseFile.shareable && !caseFile.archived);
}
