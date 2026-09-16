import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check CRON_SECRET from query param or header
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : new URL(request.url).searchParams.get('secret');

    if (providedSecret !== cronSecret) {
      console.warn('Cron request rejected: invalid secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    console.info(`Starting cleanup job for data older than ${thirtyDaysAgo.toISOString()}`);

    // Delete all Split rows where the associated Activity.startDate is older than 30 days
    const splitsDeleted = await prisma.split.deleteMany({
      where: {
        activity: {
          startDate: {
            lt: thirtyDaysAgo,
          },
        },
      },
    });

    console.info(`Deleted ${splitsDeleted.count} Split rows`);

    // Delete all Play rows where playedAt is older than 30 days
    const playsDeleted = await prisma.play.deleteMany({
      where: {
        playedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    console.info(`Deleted ${playsDeleted.count} Play rows`);

    return NextResponse.json({
      splitsDeleted: splitsDeleted.count,
      playsDeleted: playsDeleted.count,
      cutoffDate: thirtyDaysAgo.toISOString(),
    });
  } catch (error) {
    console.error('Cleanup handler error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
