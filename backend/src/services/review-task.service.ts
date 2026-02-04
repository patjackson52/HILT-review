import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reviewTasks, sources } from '../db/schema.js';
import { NotFoundError } from '../domain/errors.js';
import type { CreateReviewTaskInput } from '../domain/schemas.js';
import type { ReviewTask, ReviewTaskListItem, ArtifactBlock, ServiceIdentifier, ActionIdentifier, InteractionSchema, ExecutionIntent, ReviewDecision, DecisionDiff } from '@hilt-review/shared';

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
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ items: ReviewTaskListItem[]; total: number; nextCursor?: string }> {
    const { sourceId, status, limit = 50, cursor } = options;

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

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const results = await query;

    const hasMore = results.length > limit;
    const items = results.slice(0, limit).map(r => this.toReviewTaskListItem(r.task, r.sourceName || 'Unknown'));
    const nextCursor = hasMore ? results[limit - 1].task.id : undefined;

    // Get total count (simplified - in production would use a count query)
    const total = items.length;

    return { items, total, nextCursor };
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
