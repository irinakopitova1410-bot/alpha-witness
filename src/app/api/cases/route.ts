import { NextResponse } from 'next/server';
import { publicCase } from '@/lib/repository';
import { createAndProcessCase } from '@/lib/processor';
import { MAX_PDF_BYTES, type CreateInput } from '@/lib/contracts';
import { rateLimit, requestClientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
function validKind(value: unknown): value is CreateInput['kind'] { return value === 'url' || value === 'text' || value === 'name' || value === 'ticker' || value === 'pdf'; }
async function parseInput(request: Request): Promise<CreateInput> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) throw new Error('PDF_FILE_REQUIRED');
    if (file.size > MAX_PDF_BYTES || file.type !== 'application/pdf') throw new Error('PDF_MUST_BE_APPLICATION_PDF_AND_UNDER_2MB');
    return { kind: 'pdf', value: Buffer.from(await file.arrayBuffer()).toString('base64'), label: file.name.slice(0, 200) };
  }
  const body = await request.json() as Record<string, unknown>;
  if (!validKind(body.kind) || typeof body.value !== 'string') throw new Error('KIND_AND_VALUE_REQUIRED');
  if (body.kind === 'pdf') throw new Error('PDF_MULTIPART_UPLOAD_REQUIRED');
  const value = body.value.trim();
  if (!value || value.length > 200_000) throw new Error('VALUE_MUST_BE_1_TO_200000_CHARACTERS');
  if (body.kind === 'url') { try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { throw new Error('VALID_HTTP_URL_REQUIRED'); } }
  return { kind: body.kind, value, label: typeof body.label === 'string' ? body.label.slice(0, 200) : undefined };
}
export async function POST(request: Request) {
  const clientKey = requestClientKey(request);
  const guard = rateLimit('case-create', clientKey, 8, 10 * 60_000);
  if (!guard.allowed) return NextResponse.json({ error: 'RATE_LIMITED_TRY_AGAIN_LATER' }, { status: 429, headers: { 'Retry-After': String(guard.retryAfterSeconds) } });
  try { const input = await parseInput(request); const result = await createAndProcessCase(input, { clientKey }); return NextResponse.json(publicCase(result), { status: 201 }); }
  catch (error: unknown) { const message = error instanceof Error ? error.message : 'INVALID_REQUEST'; return bad(message, message.includes('CONFIGURATION') || message.includes('SUPABASE') ? 503 : 400); }
}
/** Guest case listing is intentionally unavailable: public cases are link-addressable only. */
export async function GET() { return NextResponse.json({ error: 'CASE_LISTING_NOT_AVAILABLE' }, { status: 404 }); }
