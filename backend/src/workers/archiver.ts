import PgBoss from 'pg-boss';
import { eq, and, lt, or, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reviewTasks, reviewDecisions } from '../db/schema.js';

const QUEUE_NAME = 'task-archive';
const POLL_INTERVAL_MS = 60000; // Check every minute
const DEFAULT_ARCHIVE_AFTER_DAYS = 30;

interface ArchiveJobData {
  taskId: string;
}

export class ArchiverWorker {
  private boss: PgBoss;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private archiveAfterDays: number;

  constructor(connectionString: string, archiveAfterDays = DEFAULT_ARCHIVE_AFTER_DAYS) {
    this.boss = new PgBoss(connectionString);
    this.archiveAfterDays = archiveAfterDays;
  }

  async start(): Promise<void> {
    await this.boss.start();

    // Register handler for archive jobs
    await this.boss.work<ArchiveJobData>(
      QUEUE_NAME,
      this.handleArchiveJob.bind(this)
    );

    this.isRunning = true;

    // Start polling for archivable tasks
    this.startPolling();

    console.log('[ArchiverWorker] Started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    await this.boss.stop();
    console.log('[ArchiverWorker] Stopped');
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.pollAndEnqueueTasks();
      } catch (error) {
        console.error('[ArchiverWorker] Polling error:', error);
      }
    }, POLL_INTERVAL_MS);

    // Also run immediately
    this.pollAndEnqueueTasks().catch(err => {
      console.error('[ArchiverWorker] Initial poll error:', err);
    });
  }

  private async pollAndEnqueueTasks(): Promise<void> {
    const archiveThreshold = new Date(
      Date.now() - this.archiveAfterDays * 24 * 60 * 60 * 1000
    );

    // Find tasks that should be archived
    // - Status is DISPATCHED and decision was made more than X days ago
    // - Status is APPROVED/DENIED (for pull-only sources) and decision was made more than X days ago
    const tasksToArchive = await db.select({
      taskId: reviewTasks.id,
      decidedAt: reviewDecisions.decidedAt,
    })
      .from(reviewTasks)
      .innerJoin(reviewDecisions, eq(reviewTasks.id, reviewDecisions.taskId))
      .where(
        and(
          or(
            eq(reviewTasks.status, 'DISPATCHED'),
            eq(reviewTasks.status, 'APPROVED'),
            eq(reviewTasks.status, 'DENIED')
          ),
          lt(reviewDecisions.decidedAt, archiveThreshold)
        )
      )
      .limit(100);

    for (const { taskId } of tasksToArchive) {
      // Enqueue archive job (singletonKey handles deduplication)
      await this.boss.send(QUEUE_NAME, { taskId }, {
        singletonKey: taskId,
        retryLimit: 3,
      });
    }

    if (tasksToArchive.length > 0) {
      console.log(`[ArchiverWorker] Enqueued ${tasksToArchive.length} tasks for archiving`);
    }
  }

  private async handleArchiveJob(job: PgBoss.Job<ArchiveJobData>): Promise<void> {
    const { taskId } = job.data;

    // Update task status to ARCHIVED
    const [updated] = await db.update(reviewTasks)
      .set({
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(reviewTasks.id, taskId),
          // Ensure we only archive already-completed tasks
          or(
            eq(reviewTasks.status, 'DISPATCHED'),
            eq(reviewTasks.status, 'APPROVED'),
            eq(reviewTasks.status, 'DENIED')
          )
        )
      )
      .returning({ id: reviewTasks.id });

    if (updated) {
      console.log(`[ArchiverWorker] Archived task ${taskId}`);
    }
  }
}
