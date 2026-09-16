import { prisma } from '@/lib/prisma';
import { matchSongsToActivity } from '@/lib/match-songs';

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
      console.warn(`No User found for athleteId ${event.athleteId.toString()}`);
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: 'failed',
          attempts: event.attempts + 1,
        },
      });
      return;
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

    console.info(`WebhookEvent ${eventId} processed successfully`, {
      userId: user.id,
      activityId: event.objectId,
      matchedCount: matchResult.matchedCount,
    });
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
    const isFinal = newAttempts >= 3;

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: isFinal ? 'failed' : 'pending',
        attempts: newAttempts,
      },
    }).catch(() => null);

    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to process WebhookEvent ${eventId}`, {
      attempt: newAttempts,
      final: isFinal,
      error: errorMsg,
    });
  }
}
