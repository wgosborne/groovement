import { prisma } from '@/lib/prisma';
import { sendAdminNotificationEmail } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, referralSource, requestReason } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'name and email are required' },
        { status: 400 }
      );
    }

    if (typeof name !== 'string' || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'name and email must be strings' },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        referralSource: referralSource || null,
        requestReason: requestReason || null,
        status: 'pending',
      },
    });

    try {
      await sendAdminNotificationEmail(
        email,
        name,
        referralSource || null,
        requestReason || null
      );
    } catch (emailError) {
      console.error('Admin notification email failed, but user was created:', emailError);
    }

    return NextResponse.json(
      { message: 'Signup successful. Please check your email for next steps.' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint failed on the fields')) {
        return NextResponse.json(
          { error: 'This email is already registered' },
          { status: 409 }
        );
      }
    }
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create signup request' },
      { status: 500 }
    );
  }
}
