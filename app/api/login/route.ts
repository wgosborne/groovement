import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { sendLoginEmail } from '@/lib/email';
import {
  generateToken,
  hashToken,
  LOGIN_TOKEN_LIMIT,
  LOGIN_TOKEN_TTL_MS,
  LOGIN_TOKEN_WINDOW_MS,
} from '@/lib/session';

// Same response whether or not the email is registered, so this can't be used to find members.
const GENERIC_MESSAGE = 'If that email is registered, a login link has been sent.';

export async function POST(req: NextRequest) {
  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });

    if (user && user.status === 'approved') {
      const recentUnused = await prisma.loginToken.count({
        where: {
          userId: user.id,
          used: false,
          createdAt: { gte: new Date(Date.now() - LOGIN_TOKEN_WINDOW_MS) },
        },
      });

      if (recentUnused < LOGIN_TOKEN_LIMIT) {
        const token = generateToken();
        await prisma.loginToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
          },
        });
        await sendLoginEmail(user.email, user.name, token);
      }
    }
  } catch (error) {
    // Logged, not surfaced, so the response stays identical for every email.
    console.error('Login request error:', error);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
