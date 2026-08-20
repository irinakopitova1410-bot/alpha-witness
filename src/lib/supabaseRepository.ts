import type { CaseFile } from './contracts';
import type { CaseRepository } from './repository';

interface SupabaseRow {
  id: string; created_at: string; updated_at: string; input: CaseFile['input']; classification: CaseFile['classification'];
  status: CaseFile['status']; title: string; shareable: boolean; archived: boolean; evidence_ledger: CaseFile['evidenceLedger'];
  claims: CaseFile['claims']; verdict: CaseFile['verdict']; notebook: CaseFile['notebook']; error: string | null;
}

function toCaseFile(row: SupabaseRow): CaseFile {
  return { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, input: row.input, classification: row.classification, status: row.status, title: row.title, shareable: row.shareable, archived: row.archived, evidenceLedger: row.evidence_ledger, claims: row.claims, verdict: row.verdict, notebook: row.notebook, ...(row.error ? { error: row.error } : {}) };
}
function toRow(item: CaseFile): SupabaseRow {
  return { id: item.id, created_at: item.createdAt, updated_at: item.updatedAt, input: item.input, classification: item.classification, status: item.status, title: item.title, shareable: item.shareable, archived: item.archived ?? false, evidence_ledger: item.evidenceLedger, claims: item.claims, verdict: item.verdict, notebook: item.notebook, error: item.error ?? null };
}

/** Server-only REST adapter. The service-role key is never imported by client code. */
export class SupabaseCaseRepository implements CaseRepository {
  private readonly endpoint: string;
  private readonly headers: HeadersInit;
  constructor(url = process.env.SUPABASE_URL, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!url || !serviceRoleKey) throw new Error('SUPABASE_SERVER_CONFIGURATION_REQUIRED');
    this.endpoint = `${url.replace(/\/$/, '')}/rest/v1/cases`;
    this.headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };
  }
  async get(id: string): Promise<CaseFile | null> {
    const response = await fetch(`${this.endpoint}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { headers: this.headers, cache: 'no-store' });
    if (!response.ok) throw new Error('SUPABASE_CASE_READ_FAILED');
    const rows = await response.json() as SupabaseRow[];
    return rows[0] ? toCaseFile(rows[0]) : null;
  }
  async put(caseFile: CaseFile): Promise<void> {
    const response = await fetch(`${this.endpoint}?on_conflict=id`, { method: 'POST', headers: { ...this.headers, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(toRow(caseFile)), cache: 'no-store' });
    if (!response.ok) throw new Error('SUPABASE_CASE_WRITE_FAILED');
  }
}
