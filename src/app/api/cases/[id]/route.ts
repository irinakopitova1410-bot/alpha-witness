import { NextResponse } from 'next/server';
import { isPublicGuestCase, publicCase } from '@/lib/repository';
import { getCaseRepository } from '@/lib/repositoryFactory';
export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const item = await (await getCaseRepository()).get(id);
    return isPublicGuestCase(item) ? NextResponse.json(publicCase(item)) : NextResponse.json({ error: 'CASE_NOT_FOUND' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'CASE_STORAGE_UNAVAILABLE' }, { status: 503 }); }
}
