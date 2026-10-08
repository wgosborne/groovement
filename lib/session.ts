import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export const SESSION_COOKIE = 'groovement_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, absolute (no sliding renewal)
export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
export const LOGIN_TOKEN_LIMIT = 3; // max unused login tokens per user...
export const LOGIN_TOKEN_WINDOW_MS = 15 * 60 * 1000; // ...per this window

export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Atomically marks a login token as used. Returns the userId only if the token
 * existed, was unused, and had not expired. The updateMany guard means two
 * concurrent confirmations of the same link can't both succeed.
 */
export async function consumeLoginToken(rawToken: string): Promise<string | null> {
  const now = new Date();
  const row = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!row) return null;

  const result = await prisma.loginToken.updateMany({
    where: { id: row.id, used: false, expiresAt: { gt: now } },
    data: { used: true },
  });
  return result.count === 1 ? row.userId : null;
}

/**
 * Returns the approved user behind the session cookie, or null if there is no
 * cookie, the session is unknown or expired, or the user is no longer approved.
 */
export async function getSessionUser() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { include: { oauthTokens: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  if (session.user.status !== 'approved') return null;

  return session.user;
}
