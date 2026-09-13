import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { status: 'pending' },
      orderBy: { requestedAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        referralSource: true,
        requestReason: true,
        requestedAt: true,
      },
    });

    return NextResponse.json(pendingUsers);
  } catch (error) {
    console.error('Failed to fetch pending users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending users' },
      { status: 500 }
    );
  }
}
