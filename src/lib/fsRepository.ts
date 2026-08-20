import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CaseFile } from './contracts';
import type { CaseRepository } from './repository';

const DATA_DIR = path.join(process.cwd(), 'data', 'cases');
const SAFE_ID = /^AW-[A-Za-z0-9_-]{16,}$/;

export class FsCaseRepository implements CaseRepository {
  private async ensure() { await fs.mkdir(DATA_DIR, { recursive: true }); }
  async get(id: string): Promise<CaseFile | null> {
    if (!SAFE_ID.test(id)) return null;
    await this.ensure();
    try { return JSON.parse(await fs.readFile(path.join(DATA_DIR, `${id}.json`), 'utf8')) as CaseFile; }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  async put(caseFile: CaseFile): Promise<void> {
    if (!SAFE_ID.test(caseFile.id)) throw new Error('INVALID_CASE_ID');
    await this.ensure();
    const target = path.join(DATA_DIR, `${caseFile.id}.json`);
    const temp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(caseFile, null, 2), 'utf8');
    await fs.rename(temp, target);
  }
}
