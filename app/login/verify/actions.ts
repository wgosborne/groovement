'use server';

import { redirect } from 'next/navigation';
import { consumeLoginToken, createSession } from '@/lib/session';

export async function confirmLogin(formData: FormData): Promise<void> {
  const token = formData.get('token');
  if (typeof token !== 'string' || !token) {
    redirect('/login?error=link_invalid');
  }

  const userId = await consumeLoginToken(token);
  if (!userId) {
    redirect('/login?error=link_invalid');
  }

  await createSession(userId);
  redirect('/profile');
}
