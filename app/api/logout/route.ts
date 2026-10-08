import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hashToken, SESSION_COOKIE } from '@/lib/session';

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;

  if (raw) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
  }

  const response = NextResponse.redirect(new URL('/login', req.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
