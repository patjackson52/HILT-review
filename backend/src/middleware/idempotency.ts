import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { idempotencyKeys } from '../db/schema.js';
import { IdempotencyError } from '../domain/errors.js';

const IDEMPOTENCY_HEADER = 'idempotency-key';

declare module 'fastify' {
  interface FastifyRequest {
    idempotencyKey?: string;
    idempotencyRequestHash?: string;
  }
}

/**
 * Fastify plugin that implements idempotency for POST requests.
 *
 * Register this plugin on route scopes that need idempotency support.
 * When a request includes an Idempotency-Key header:
 * 1. If the key was used before and the body matches, return the cached response
 * 2. If the key was used before but the body differs, return 409
 * 3. If the key is new, proceed and cache the successful response
 */
export async function idempotencyPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('idempotencyKey', undefined);
  app.decorateRequest('idempotencyRequestHash', undefined);

  // onSend hook to cache responses for new idempotency keys
  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: string) => {
    const key = request.idempotencyKey;
    if (!key) return payload;

    const statusCode = reply.statusCode;
    // Only cache successful responses (2xx)
    if (statusCode >= 200 && statusCode < 300) {
      try {
        await db.insert(idempotencyKeys).values({
          key,
          requestHash: request.idempotencyRequestHash!,
          response: { statusCode, body: payload },
        }).onConflictDoNothing();
      } catch (err) {
        request.log.error(err, 'Failed to store idempotency key');
      }
    }

    return payload;
  });
}

/**
 * preHandler middleware to check the idempotency cache.
 * Use together with the idempotencyPlugin registered on the same scope.
 */
export async function requireIdempotency(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const key = request.headers[IDEMPOTENCY_HEADER] as string | undefined;

  if (!key) {
    return; // No idempotency key — proceed normally
  }

  const requestHash = hashBody(request.body);

  // Check for existing key
  const [existing] = await db.select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key));

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyError();
    }

    // Return cached response
    const cached = existing.response as { statusCode: number; body: string };
    reply.status(cached.statusCode).send(cached.body);
    return;
  }

  // Store key on request so onSend hook can cache the response
  request.idempotencyKey = key;
  request.idempotencyRequestHash = requestHash;
}

function hashBody(body: unknown): string {
  const serialized = JSON.stringify(body ?? '');
  return createHash('sha256').update(serialized).digest('hex');
}
