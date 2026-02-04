import { FastifyInstance } from 'fastify';
import { eq, and, desc, isNull, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { decisionEvents, sources } from '../db/schema.js';
import { requireApiKey } from '../middleware/auth.js';
import { z } from 'zod';
import type { DecisionEvent } from '@hilt-review/shared';

const ListEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
  include_delivered: z.coerce.boolean().optional().default(false),
});

const AckEventsBodySchema = z.object({
  event_ids: z.array(z.string().uuid()).min(1).max(100),
});

export async function decisionEventsRoutes(app: FastifyInstance) {
  // List decision events for a source (pull API)
  app.get('/decision-events', {
    preHandler: [requireApiKey],
  }, async (request) => {
    const query = ListEventsQuerySchema.parse(request.query);
    const apiKey = request.apiKey!;

    // Build conditions
    const conditions = [];

    // If source-scoped key, only show events for that source
    if (apiKey.sourceId) {
      conditions.push(eq(decisionEvents.sourceId, apiKey.sourceId));
    }

    // Filter by delivery status
    if (!query.include_delivered) {
      conditions.push(eq(decisionEvents.delivered, false));
    }

    let eventsQuery = db.select({
      event: decisionEvents,
      sourceName: sources.name,
    })
      .from(decisionEvents)
      .leftJoin(sources, eq(decisionEvents.sourceId, sources.id))
      .orderBy(desc(decisionEvents.createdAt))
      .limit(query.limit + 1);

    if (conditions.length > 0) {
      eventsQuery = eventsQuery.where(and(...conditions)) as typeof eventsQuery;
    }

    const results = await eventsQuery;

    const hasMore = results.length > query.limit;
    const events = results.slice(0, query.limit).map(r => {
      return r.event.payload as unknown as DecisionEvent;
    });
    const nextCursor = hasMore ? results[query.limit - 1].event.id : undefined;

    return {
      events,
      next_cursor: nextCursor,
    };
  });

  // Acknowledge events (mark as delivered)
  app.post('/decision-events/ack', {
    preHandler: [requireApiKey],
  }, async (request, reply) => {
    const body = AckEventsBodySchema.parse(request.body);
    const apiKey = request.apiKey!;

    // Build conditions for update
    const conditions = body.event_ids.map(id => eq(decisionEvents.id, id));

    // For source-scoped keys, only allow acking events for that source
    let whereClause = or(...conditions);
    if (apiKey.sourceId) {
      whereClause = and(whereClause, eq(decisionEvents.sourceId, apiKey.sourceId));
    }

    const updated = await db.update(decisionEvents)
      .set({
        delivered: true,
        lastAttemptAt: new Date(),
      })
      .where(whereClause!)
      .returning({ id: decisionEvents.id });

    return {
      acknowledged: updated.length,
      event_ids: updated.map(e => e.id),
    };
  });

  // Get single event by ID
  app.get<{ Params: { id: string } }>('/decision-events/:id', {
    preHandler: [requireApiKey],
  }, async (request, reply) => {
    const apiKey = request.apiKey!;

    const conditions = [eq(decisionEvents.id, request.params.id)];
    if (apiKey.sourceId) {
      conditions.push(eq(decisionEvents.sourceId, apiKey.sourceId));
    }

    const [result] = await db.select()
      .from(decisionEvents)
      .where(and(...conditions));

    if (!result) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Decision event not found',
        },
      });
    }

    return result.payload as DecisionEvent;
  });
}
