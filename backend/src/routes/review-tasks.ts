import { FastifyInstance } from 'fastify';
import { reviewTaskService } from '../services/review-task.service.js';
import { CreateReviewTaskSchema, ListReviewTasksQuerySchema, PatchBlocksSchema, SubmitDecisionSchema } from '../domain/schemas.js';
import { requireApiKey, requireMatchingSource } from '../middleware/auth.js';

export async function reviewTasksRoutes(app: FastifyInstance) {
  // Create review task (requires API key)
  app.post('/review-tasks', {
    preHandler: [requireApiKey, requireMatchingSource('source_id')],
  }, async (request, reply) => {
    const input = CreateReviewTaskSchema.parse(request.body);
    const task = await reviewTaskService.create(input);
    return reply.status(201).send(task);
  });

  // Get review task by ID
  app.get<{ Params: { id: string } }>('/review-tasks/:id', async (request) => {
    return reviewTaskService.getById(request.params.id);
  });

  // List review tasks
  app.get('/review-tasks', async (request) => {
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

  // Update working blocks
  app.patch<{ Params: { id: string } }>('/review-tasks/:id/blocks', async (request) => {
    const input = PatchBlocksSchema.parse(request.body);
    return reviewTaskService.updateBlocks(request.params.id, input);
  });

  // Submit decision
  app.post<{ Params: { id: string } }>('/review-tasks/:id/decision', async (request) => {
    const input = SubmitDecisionSchema.parse(request.body);
    // TODO: Get decidedBy from session when auth is implemented
    return reviewTaskService.submitDecision(request.params.id, input);
  });
}
