import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
/** No owner authentication exists in this public MVP, so private notes cannot be written. */
export async function POST() {
  return NextResponse.json({ error: 'NOTES_REQUIRE_OWNER_AUTHENTICATION' }, { status: 401 });
}
