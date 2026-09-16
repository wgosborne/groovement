import { NextRequest, NextResponse } from 'next/server';
import { matchSongsToActivity } from '@/lib/match-songs';

export async function POST(request: NextRequest) {
  try {
    // ===== AUTH CHECK (same as cron routes) =====
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (providedSecret !== cronSecret) {
      console.warn('Manual backfill rejected: invalid authorization');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ===== VALIDATE PARAMS =====
    const { searchParams } = new URL(request.url);
    const activityIdStr = searchParams.get('activity_id');
    const userId = searchParams.get('user_id');

    if (!activityIdStr || !userId) {
      return NextResponse.json(
        { error: 'Missing required params: activity_id and user_id' },
        { status: 400 }
      );
    }

    let activityId: bigint;
    try {
      activityId = BigInt(activityIdStr);
    } catch {
      return NextResponse.json(
        { error: 'Invalid activity_id: must be a valid number' },
        { status: 400 }
      );
    }

    console.info('Manual backfill triggered', {
      userId,
      activityId: activityId.toString(),
    });

    // ===== RUN MATCHING =====
    const matchResult = await matchSongsToActivity(userId, activityId);

    if (!matchResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to match songs to activity',
          activityId: activityId.toString(),
          userId,
        },
        { status: 500 }
      );
    }

    // ===== RETURN RESULT =====
    console.info('Manual backfill completed successfully', {
      userId,
      activityId: activityId.toString(),
      matchedCount: matchResult.matchedCount,
    });

    return NextResponse.json(
      {
        success: true,
        userId,
        activityId: activityId.toString(),
        matchedCount: matchResult.matchedCount,
        description: matchResult.description,
        message: `Successfully backfilled activity. Matched ${matchResult.matchedCount} splits and updated Strava description.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Manual backfill error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMsg },
      { status: 500 }
    );
  }
}
