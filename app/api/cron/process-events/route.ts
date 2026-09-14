import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processWebhookEvent } from '@/lib/process-webhook-event';

export async function GET(request: NextRequest) {
  try {
    // Check CRON_SECRET from query param or header
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const providedSecret = request.headers.get('x-cron-secret') ||
                          new URL(request.url).searchParams.get('secret');

    if (providedSecret !== cronSecret) {
      console.warn('Cron request rejected: invalid secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find pending events older than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const staleEvents = await prisma.webhookEvent.findMany({
      where: {
        status: 'pending',
        updatedAt: {
          lt: fiveMinutesAgo,
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    });

    console.info(`Found ${staleEvents.length} stale events to process`);

    let processed = 0;
    let failed = 0;

    for (const event of staleEvents) {
      try {
        await processWebhookEvent(event.id);
        processed++;
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error);
        failed++;
      }
    }

    return NextResponse.json({
      processed,
      failed,
      total: staleEvents.length,
    });
  } catch (error) {
    console.error('Cron handler error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
