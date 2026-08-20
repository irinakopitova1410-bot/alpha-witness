import type { CaseRepository } from './repository';
import { FsCaseRepository } from './fsRepository';
import { SupabaseCaseRepository } from './supabaseRepository';

let repository: CaseRepository | undefined;

/** Creates one server-side repository per process. Local FS is intentionally the development default. */
export async function getCaseRepository(): Promise<CaseRepository> {
  if (repository) return repository;
  const backend = process.env.STORAGE_BACKEND || 'local';
  if (backend === 'local') return repository = new FsCaseRepository();
  if (backend === 'supabase') return repository = new SupabaseCaseRepository();
  throw new Error('UNSUPPORTED_STORAGE_BACKEND');
}

/** Test-only helper; production code must use getCaseRepository(). */
export function resetCaseRepositoryForTests() { repository = undefined; }
