import PgBoss from 'pg-boss';
import { eq, and, or, lt, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { decisionEvents, sources, reviewTasks } from '../db/schema.js';
import { webhookService } from '../services/webhook.service.js';
import type { DecisionEvent } from '@hilt-review/shared';

const QUEUE_NAME = 'decision-dispatch';
const POLL_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 10;

interface DispatchJobData {
  eventId: string;
}

export class DecisionDispatcher {
  private boss: PgBoss;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(connectionString: string) {
    this.boss = new PgBoss(connectionString);
  }

  async start(): Promise<void> {
    await this.boss.start();

    // Register handler for dispatch jobs
    await this.boss.work<DispatchJobData>(
      QUEUE_NAME,
      this.handleDispatchJob.bind(this)
    );

    this.isRunning = true;

    // Start polling for undelivered events
    this.startPolling();

    console.log('[DecisionDispatcher] Started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    await this.boss.stop();
    console.log('[DecisionDispatcher] Stopped');
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.pollAndEnqueueEvents();
      } catch (error) {
        console.error('[DecisionDispatcher] Polling error:', error);
      }
    }, POLL_INTERVAL_MS);

    // Also run immediately
    this.pollAndEnqueueEvents().catch(err => {
      console.error('[DecisionDispatcher] Initial poll error:', err);
    });
  }

  private async pollAndEnqueueEvents(): Promise<void> {
    // Find undelivered events for sources that use webhooks
    const pendingEvents = await db.select({
      event: decisionEvents,
      source: sources,
    })
      .from(decisionEvents)
      .innerJoin(sources, eq(decisionEvents.sourceId, sources.id))
      .where(
        and(
          eq(decisionEvents.delivered, false),
          eq(sources.webhookEnabled, true),
          or(
            eq(sources.deliveryMode, 'WEBHOOK_ONLY'),
            eq(sources.deliveryMode, 'WEBHOOK_AND_PULL')
          ),
          // Only retry if enough time has passed since last attempt
          or(
            isNull(decisionEvents.lastAttemptAt),
            lt(
              decisionEvents.lastAttemptAt,
              new Date(Date.now() - 30000) // At least 30 seconds since last attempt
            )
          )
        )
      )
      .limit(MAX_BATCH_SIZE);

    for (const { event } of pendingEvents) {
      // Check if already in queue
      const existing = await this.boss.getJobById(event.id);
      if (existing) continue;

      // Enqueue dispatch job
      await this.boss.send(QUEUE_NAME, { eventId: event.id }, {
        singletonKey: event.id, // Use event ID for deduplication
        retryLimit: 0, // We handle retries ourselves
      });
    }
  }

  private async handleDispatchJob(job: PgBoss.Job<DispatchJobData>): Promise<void> {
    const { eventId } = job.data;

    // Fetch event with source config
    const [result] = await db.select({
      event: decisionEvents,
      source: sources,
    })
      .from(decisionEvents)
      .innerJoin(sources, eq(decisionEvents.sourceId, sources.id))
      .where(eq(decisionEvents.id, eventId));

    if (!result) {
      console.warn(`[DecisionDispatcher] Event ${eventId} not found`);
      return;
    }

    const { event, source } = result;

    // Skip if already delivered
    if (event.delivered) {
      return;
    }

    // Check max attempts
    const maxAttempts = source.webhookMaxAttempts ?? 10;
    if ((event.deliveryAttempts ?? 0) >= maxAttempts) {
      console.warn(`[DecisionDispatcher] Event ${eventId} exceeded max attempts`);
      return;
    }

    // Send webhook
    const payload = event.payload as unknown as DecisionEvent;
    const webhookResult = await webhookService.sendWebhook(source, payload, eventId);

    if (webhookResult.success) {
      // Mark as delivered
      await db.update(decisionEvents)
        .set({
          delivered: true,
          lastAttemptAt: new Date(),
        })
        .where(eq(decisionEvents.id, eventId));

      // Update task status to DISPATCHED
      await db.update(reviewTasks)
        .set({
          status: 'DISPATCHED',
          updatedAt: new Date(),
        })
        .where(eq(reviewTasks.id, event.taskId));

      console.log(`[DecisionDispatcher] Event ${eventId} delivered successfully`);
    } else {
      // Increment attempts
      const newAttempts = (event.deliveryAttempts ?? 0) + 1;

      await db.update(decisionEvents)
        .set({
          deliveryAttempts: newAttempts,
          lastAttemptAt: new Date(),
        })
        .where(eq(decisionEvents.id, eventId));

      if (webhookResult.retryable && newAttempts < maxAttempts) {
        // Schedule retry
        const backoffSeconds = source.webhookRetryBackoffSeconds ?? 30;
        const delay = webhookService.calculateRetryDelay(newAttempts, backoffSeconds);

        await this.boss.send(QUEUE_NAME, { eventId }, {
          startAfter: delay / 1000, // pg-boss expects seconds
        });

        console.log(
          `[DecisionDispatcher] Event ${eventId} failed (attempt ${newAttempts}/${maxAttempts}), ` +
          `retrying in ${Math.round(delay / 1000)}s: ${webhookResult.error}`
        );
      } else {
        console.error(
          `[DecisionDispatcher] Event ${eventId} failed permanently: ${webhookResult.error}`
        );
      }
    }
  }
}
