import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendApprovalEmail } from '@/lib/email';

function generateConnectToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.status !== 'pending') {
      return NextResponse.json(
        { error: `User is already ${user.status}, cannot approve` },
        { status: 400 }
      );
    }

    const connectToken = generateConnectToken();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'approved',
        connectToken,
        approvedAt: new Date(),
      },
    });

    try {
      await sendApprovalEmail(user.email, user.name, connectToken);
    } catch (emailError) {
      console.error('Failed to send approval email, but user was approved:', emailError);
    }

    return NextResponse.json({
      message: 'User approved and email sent',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
      },
    });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json(
      { error: 'Failed to approve user' },
      { status: 500 }
    );
  }
}
