import { NextRequest, NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processWebhookEvent } from '@/lib/process-webhook-event';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = searchParams.get('hub.verify_token');

  const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error(
      'STRAVA_WEBHOOK_VERIFY_TOKEN not configured'
    );
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  if (verifyToken !== expectedToken) {
    console.warn('Strava webhook verification failed: invalid token');
    return NextResponse.json(
      { error: 'Invalid verification token' },
      { status: 403 }
    );
  }

  if (mode === 'subscribe' && challenge) {
    return NextResponse.json(
      { 'hub.challenge': challenge },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { error: 'Invalid request' },
    { status: 400 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      object_type,
      object_id,
      aspect_type,
      owner_id,
      event_time,
    } = body;

    // Only process activity creates for now
    if (object_type !== 'activity' || aspect_type !== 'create') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Validate required fields
    if (!object_id || !aspect_type || !owner_id || !event_time) {
      console.warn('Strava webhook missing required fields', {
        object_id,
        aspect_type,
        owner_id,
        event_time,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const eventDateTime = new Date(event_time * 1000);

    try {
      const newEvent = await prisma.webhookEvent.create({
        data: {
          objectId: BigInt(object_id),
          aspectType: aspect_type,
          eventTime: eventDateTime,
          athleteId: BigInt(owner_id),
          status: 'pending',
        },
      });

      console.log('Strava webhook event recorded', {
        objectId: object_id,
        aspectType: aspect_type,
        athleteId: owner_id,
      });

      // Trigger immediate processing without blocking the response
      after(() => processWebhookEvent(newEvent.id));
    } catch (error) {
      // Check if this is a unique constraint violation (duplicate event)
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        console.info('Strava webhook event already recorded', {
          objectId: object_id,
          aspectType: aspect_type,
          eventTime: eventDateTime.toISOString(),
        });
      } else {
        // Log other DB errors but still respond 200 to avoid Strava retries
        console.error('Failed to record Strava webhook event', {
          error: error instanceof Error ? error.message : String(error),
          objectId: object_id,
          aspectType: aspect_type,
        });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Strava webhook parsing error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
