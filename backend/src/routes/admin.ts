import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql, eq, count } from 'drizzle-orm';
import { requireAdminKey } from '../middleware/auth.js';
import { apiKeyService } from '../services/api-key.service.js';
import { db } from '../db/index.js';
import { reviewTasks, sources, decisionEvents, apiKeys } from '../db/schema.js';

const GenerateApiKeySchema = z.object({
  source_id: z.string().uuid().optional(),
  key_type: z.enum(['source', 'admin']),
  environment: z.enum(['live', 'test']),
  name: z.string().optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require an admin API key
  app.addHook('preHandler', requireAdminKey);

  // --- API Key Management ---

  // Generate a new API key
  app.post('/admin/api-keys', async (request, reply) => {
    const input = GenerateApiKeySchema.parse(request.body);

    const result = await apiKeyService.generate({
      sourceId: input.source_id,
      keyType: input.key_type,
      environment: input.environment,
      name: input.name,
    });

    return reply.status(201).send({
      key: result.key, // Only returned once
      id: result.record.id,
      source_id: result.record.sourceId,
      key_type: result.record.keyType,
      environment: result.record.environment,
      name: result.record.name,
    });
  });

  // List API keys for a source
  app.get<{ Params: { sourceId: string } }>(
    '/admin/sources/:sourceId/api-keys',
    async (request) => {
      const keys = await apiKeyService.listBySource(request.params.sourceId);
      return { items: keys };
    }
  );

  // Revoke an API key
  app.delete<{ Params: { id: string } }>(
    '/admin/api-keys/:id',
    async (request, reply) => {
      await apiKeyService.revoke(request.params.id);
      return reply.status(204).send();
    }
  );

  // --- System Stats ---

  // Get system overview stats
  app.get('/admin/stats', async () => {
    // Task counts by status
    const taskCountRows = await db
      .select({
        status: reviewTasks.status,
        count: count(),
      })
      .from(reviewTasks)
      .groupBy(reviewTasks.status);

    const tasksByStatus: Record<string, number> = {};
    for (const row of taskCountRows) {
      tasksByStatus[row.status] = row.count;
    }

    // Source count
    const [sourceCount] = await db
      .select({ count: count() })
      .from(sources);

    // Undelivered decision events
    const [pendingEvents] = await db
      .select({ count: count() })
      .from(decisionEvents)
      .where(eq(decisionEvents.delivered, false));

    // Active API keys (not revoked)
    const [activeKeys] = await db
      .select({ count: count() })
      .from(apiKeys)
      .where(sql`${apiKeys.revokedAt} IS NULL`);

    return {
      tasks: {
        by_status: tasksByStatus,
        total: Object.values(tasksByStatus).reduce((a, b) => a + b, 0),
      },
      sources: {
        total: sourceCount.count,
      },
      decision_events: {
        pending_delivery: pendingEvents.count,
      },
      api_keys: {
        active: activeKeys.count,
      },
    };
  });
}
