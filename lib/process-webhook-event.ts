import { prisma } from '@/lib/prisma';
import { matchSongsToActivity } from '@/lib/match-songs';

class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

export async function processWebhookEvent(eventId: string): Promise<void> {
  try {
    // Fetch the WebhookEvent
    const event = await prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      console.warn(`WebhookEvent ${eventId} not found`);
      return;
    }

    // Early exit if already processed
    if (event.status !== 'pending') {
      console.info(`WebhookEvent ${eventId} already processed (status: ${event.status})`);
      return;
    }

    // Resolve athleteId to a User
    const user = await prisma.user.findUnique({
      where: { stravaAthleteId: event.athleteId },
    });

    if (!user) {
      throw new NonRetryableError(`No User found for athleteId ${event.athleteId.toString()}`);
    }

    // Update the WebhookEvent with the resolved userId
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { userId: user.id },
    });

    // Match songs to activity (includes fetching splits and updating Strava)
    const matchResult = await matchSongsToActivity(user.id, event.objectId);

    if (!matchResult.success) {
      throw new Error('Failed to match songs to activity');
    }

    // Mark as completed
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: 'completed',
        processedAt: new Date(),
      },
    });

    if (matchResult.matchedCount === 0) {
      console.info(`WebhookEvent ${eventId} completed with no splits to match`, {
        userId: user.id,
        activityId: event.objectId,
      });
    } else {
      console.info(`WebhookEvent ${eventId} processed successfully`, {
        userId: user.id,
        activityId: event.objectId,
        matchedCount: matchResult.matchedCount,
      });
    }
  } catch (error) {
    // Wrap in try/catch so this never throws uncaught
    const event = await prisma.webhookEvent.findUnique({
      where: { id: eventId },
    }).catch(() => null);

    if (!event) {
      console.error(`Failed to fetch event ${eventId} for error handling`);
      return;
    }

    const newAttempts = event.attempts + 1;
    const isFinal = error instanceof NonRetryableError || newAttempts >= 3;

    // Extract error details: name + message, truncated to 500 chars
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMsg = error instanceof Error ? error.message : String(error);
    const fullErrorMsg = `[${errorName}] ${errorMsg}`;
    const truncatedErrorMsg = fullErrorMsg.length > 500
      ? fullErrorMsg.slice(0, 497) + '...'
      : fullErrorMsg;

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: isFinal ? 'failed' : 'pending',
        attempts: newAttempts,
        ...(isFinal && { errorMessage: truncatedErrorMsg }),
      },
    }).catch(() => null);

    console.error(`Failed to process WebhookEvent ${eventId}`, {
      attempt: newAttempts,
      final: isFinal,
      error: truncatedErrorMsg,
    });
  }
}
