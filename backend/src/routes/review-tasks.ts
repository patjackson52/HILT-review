import { FastifyInstance } from 'fastify';
import { reviewTaskService } from '../services/review-task.service.js';
import { CreateReviewTaskSchema, ListReviewTasksQuerySchema, PatchBlocksSchema, SubmitDecisionSchema } from '../domain/schemas.js';
import { requireApiKey, requireMatchingSource, requireSession } from '../middleware/auth.js';
import { idempotencyPlugin, requireIdempotency } from '../middleware/idempotency.js';

export async function reviewTasksRoutes(app: FastifyInstance) {
  // Register idempotency plugin for this route scope
  await app.register(idempotencyPlugin);

  // Create review task (requires API key from agent)
  // Supports Idempotency-Key header to prevent duplicate creation on retries
  app.post('/review-tasks', {
    preHandler: [requireApiKey, requireMatchingSource('source_id'), requireIdempotency],
  }, async (request, reply) => {
    const input = CreateReviewTaskSchema.parse(request.body);
    const task = await reviewTaskService.create(input);
    return reply.status(201).send(task);
  });

  // Get review task by ID (requires session - reviewer access)
  app.get<{ Params: { id: string } }>('/review-tasks/:id', {
    preHandler: [requireSession],
  }, async (request) => {
    return reviewTaskService.getById(request.params.id);
  });

  // List review tasks (requires session - reviewer access)
  app.get('/review-tasks', {
    preHandler: [requireSession],
  }, async (request) => {
    const query = ListReviewTasksQuerySchema.parse(request.query);
    const result = await reviewTaskService.list({
      sourceId: query.source_id,
      status: query.status,
      riskLevel: query.risk_level,
      serviceId: query.service_id,
      actionType: query.action_type,
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      items: result.items,
      total_count: result.total,
      next_cursor: result.nextCursor,
    };
  });

  // Update working blocks (requires session - reviewer access)
  app.patch<{ Params: { id: string } }>('/review-tasks/:id/blocks', {
    preHandler: [requireSession],
  }, async (request) => {
    const input = PatchBlocksSchema.parse(request.body);
    return reviewTaskService.updateBlocks(request.params.id, input);
  });

  // Submit decision (requires session - reviewer access)
  app.post<{ Params: { id: string } }>('/review-tasks/:id/decision', {
    preHandler: [requireSession],
  }, async (request) => {
    const input = SubmitDecisionSchema.parse(request.body);
    // Get decidedBy from session
    const decidedBy = request.userId;
    return reviewTaskService.submitDecision(request.params.id, input, decidedBy);
  });
}
