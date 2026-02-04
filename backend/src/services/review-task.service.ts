import { randomUUID } from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reviewTasks, sources, reviewDecisions, decisionEvents } from '../db/schema.js';
import { NotFoundError, InvalidStateError } from '../domain/errors.js';
import type { CreateReviewTaskInput, PatchBlocksInput, SubmitDecisionInput } from '../domain/schemas.js';
import type { ReviewTask, ReviewTaskListItem, ArtifactBlock, ServiceIdentifier, ActionIdentifier, InteractionSchema, ExecutionIntent, ReviewDecision, DecisionDiff, DecisionEvent } from '@hilt-review/shared';
import { diffService } from './diff.service.js';

export class ReviewTaskService {
  async create(input: CreateReviewTaskInput): Promise<ReviewTask> {
    // Verify source exists
    const [source] = await db.select().from(sources).where(eq(sources.id, input.source_id));
    if (!source) {
      throw new NotFoundError('Source', input.source_id);
    }

    // Generate preview from first block content
    let preview: string | undefined;
    if (input.blocks.length > 0) {
      const firstBlock = input.blocks[0];
      const content = typeof firstBlock.content === 'string'
        ? firstBlock.content
        : JSON.stringify(firstBlock.content);
      preview = content.substring(0, 200);
    }

    const [task] = await db.insert(reviewTasks).values({
      sourceId: input.source_id,
      title: input.title,
      preview,
      priority: input.priority || 'NORMAL',
      service: input.service,
      sourceService: input.source_service,
      action: input.action,
      riskLevel: input.risk_level,
      riskWarning: input.risk_warning,
      interactionSchema: input.interaction_schema,
      executionIntent: input.execution_intent,
      blocksOriginal: input.blocks,
      blocksWorking: input.blocks,
      metadata: input.metadata,
    }).returning();

    return this.toReviewTask(task, source.name);
  }

  async getById(id: string): Promise<ReviewTask> {
    const [task] = await db.select({
      task: reviewTasks,
      sourceName: sources.name,
    })
      .from(reviewTasks)
      .leftJoin(sources, eq(reviewTasks.sourceId, sources.id))
      .where(eq(reviewTasks.id, id));

    if (!task) {
      throw new NotFoundError('ReviewTask', id);
    }

    return this.toReviewTask(task.task, task.sourceName || 'Unknown');
  }

  async list(options: {
    sourceId?: string;
    status?: string;
    riskLevel?: string;
    serviceId?: string;
    actionType?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ items: ReviewTaskListItem[]; total: number; nextCursor?: string }> {
    const { sourceId, status, riskLevel, serviceId, actionType, limit = 50, cursor } = options;

    let query = db.select({
      task: reviewTasks,
      sourceName: sources.name,
    })
      .from(reviewTasks)
      .leftJoin(sources, eq(reviewTasks.sourceId, sources.id))
      .orderBy(desc(reviewTasks.createdAt))
      .limit(limit + 1);

    const conditions = [];
    if (sourceId) {
      conditions.push(eq(reviewTasks.sourceId, sourceId));
    }
    if (status) {
      conditions.push(eq(reviewTasks.status, status as 'PENDING' | 'APPROVED' | 'DENIED' | 'DISPATCHED' | 'ARCHIVED'));
    }
    if (riskLevel) {
      conditions.push(eq(reviewTasks.riskLevel, riskLevel as 'low' | 'medium' | 'high' | 'critical'));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    let results = await query;

    // Filter by service_id and action_type in memory (JSONB columns)
    if (serviceId) {
      results = results.filter(r => {
        const service = r.task.service as ServiceIdentifier;
        return service?.id === serviceId;
      });
    }
    if (actionType) {
      results = results.filter(r => {
        const action = r.task.action as ActionIdentifier;
        return action?.type === actionType;
      });
    }

    const hasMore = results.length > limit;
    const items = results.slice(0, limit).map(r => this.toReviewTaskListItem(r.task, r.sourceName || 'Unknown'));
    const nextCursor = hasMore ? results[limit - 1].task.id : undefined;

    // Get total count (simplified - in production would use a count query)
    const total = items.length;

    return { items, total, nextCursor };
  }

  async updateBlocks(id: string, input: PatchBlocksInput): Promise<ReviewTask> {
    // Get task and verify it exists and is in PENDING status
    const [result] = await db.select({
      task: reviewTasks,
      sourceName: sources.name,
    })
      .from(reviewTasks)
      .leftJoin(sources, eq(reviewTasks.sourceId, sources.id))
      .where(eq(reviewTasks.id, id));

    if (!result) {
      throw new NotFoundError('ReviewTask', id);
    }

    if (result.task.status !== 'PENDING') {
      throw new InvalidStateError('Cannot modify blocks after decision', {
        current_status: result.task.status,
      });
    }

    // Update working blocks
    const [updated] = await db.update(reviewTasks)
      .set({
        blocksWorking: input.blocks_working,
        updatedAt: new Date(),
      })
      .where(eq(reviewTasks.id, id))
      .returning();

    return this.toReviewTask(updated, result.sourceName || 'Unknown');
  }

  async submitDecision(id: string, input: SubmitDecisionInput, decidedBy?: string): Promise<ReviewTask> {
    // Get task and verify it exists and is in PENDING status
    const [result] = await db.select({
      task: reviewTasks,
      sourceName: sources.name,
    })
      .from(reviewTasks)
      .leftJoin(sources, eq(reviewTasks.sourceId, sources.id))
      .where(eq(reviewTasks.id, id));

    if (!result) {
      throw new NotFoundError('ReviewTask', id);
    }

    if (result.task.status !== 'PENDING') {
      throw new InvalidStateError('Decision already submitted', {
        current_status: result.task.status,
      });
    }

    const originalBlocks = result.task.blocksOriginal as ArtifactBlock[];
    const workingBlocks = result.task.blocksWorking as ArtifactBlock[];

    // Calculate diff
    const diff = diffService.calculateDiff(originalBlocks, workingBlocks);

    const newStatus = input.decision === 'APPROVE' ? 'APPROVED' : 'DENIED';
    const now = new Date();

    // Use transaction for atomicity
    const [updatedTask] = await db.transaction(async (tx) => {
      // Update task status
      const [task] = await tx.update(reviewTasks)
        .set({
          status: newStatus,
          blocksFinal: workingBlocks,
          diff,
          updatedAt: now,
        })
        .where(eq(reviewTasks.id, id))
        .returning();

      // Insert decision record
      await tx.insert(reviewDecisions).values({
        taskId: id,
        decision: input.decision,
        reason: input.reason,
        decidedBy,
        decidedAt: now,
      });

      // Insert decision event for outbox
      await tx.insert(decisionEvents).values({
        taskId: id,
        sourceId: result.task.sourceId,
        decision: input.decision,
        payload: {
          event_id: randomUUID(),
          source_id: result.task.sourceId,
          task_id: id,
          decision: {
            type: input.decision,
            reason: input.reason,
            decided_at: now.toISOString(),
            decided_by: decidedBy,
          },
          original: originalBlocks,
          final: workingBlocks,
          diff,
          metadata: result.task.metadata,
          occurred_at: now.toISOString(),
        },
      });

      return [task];
    });

    return this.toReviewTask(updatedTask, result.sourceName || 'Unknown');
  }

  private toReviewTask(row: typeof reviewTasks.$inferSelect, sourceName: string): ReviewTask {
    return {
      id: row.id,
      source_id: row.sourceId,
      source_name: sourceName,
      status: row.status,
      priority: row.priority,
      title: row.title,
      preview: row.preview ?? undefined,
      service: row.service as ServiceIdentifier,
      source_service: row.sourceService as ServiceIdentifier | undefined,
      action: row.action as ActionIdentifier,
      risk_level: row.riskLevel,
      risk_warning: row.riskWarning ?? undefined,
      interaction_schema: row.interactionSchema as InteractionSchema | undefined,
      blocks_original: row.blocksOriginal as ArtifactBlock[],
      blocks_working: row.blocksWorking as ArtifactBlock[],
      blocks_final: row.blocksFinal as ArtifactBlock[] | undefined,
      diff: row.diff as DecisionDiff | undefined,
      decision: undefined, // Would join with decisions table
      execution_intent: row.executionIntent as ExecutionIntent | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      archived_at: row.archivedAt?.toISOString(),
    };
  }

  private toReviewTaskListItem(row: typeof reviewTasks.$inferSelect, sourceName: string): ReviewTaskListItem {
    const blocks = row.blocksOriginal as ArtifactBlock[];
    const workingBlocks = row.blocksWorking as ArtifactBlock[];

    return {
      id: row.id,
      source_id: row.sourceId,
      source_name: sourceName,
      status: row.status,
      priority: row.priority,
      title: row.title,
      preview: row.preview ?? undefined,
      service: row.service as ServiceIdentifier,
      source_service: row.sourceService as ServiceIdentifier | undefined,
      action: row.action as ActionIdentifier,
      risk_level: row.riskLevel,
      risk_warning: row.riskWarning ?? undefined,
      block_count: blocks.length,
      has_changes: JSON.stringify(blocks) !== JSON.stringify(workingBlocks),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}

export const reviewTaskService = new ReviewTaskService();
