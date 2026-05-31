import { NextRequest, NextResponse } from 'next/server';
import { setAdminSessionCookie, verifyAdminPassword } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };

  if (!password || !verifyAdminPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  await setAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
