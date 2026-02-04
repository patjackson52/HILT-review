import { FastifyRequest, FastifyReply } from 'fastify';
import { apiKeyService, ApiKeyInfo } from '../services/api-key.service.js';
import { UnauthorizedError, ForbiddenError } from '../domain/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyInfo;
  }
}

/**
 * Middleware that requires a valid API key in the Authorization header.
 * Format: Authorization: Bearer hilt_live_xxxxx or Authorization: Bearer hilt_test_xxxxx
 */
export async function requireApiKey(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  const [scheme, key] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !key) {
    throw new UnauthorizedError('Invalid Authorization header format. Use: Bearer <api_key>');
  }

  const apiKeyInfo = await apiKeyService.validate(key);

  if (!apiKeyInfo) {
    throw new UnauthorizedError('Invalid or revoked API key');
  }

  request.apiKey = apiKeyInfo;
}

/**
 * Middleware that requires a source-scoped API key.
 * The API key must be associated with a specific source.
 */
export async function requireSourceKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireApiKey(request, reply);

  if (!request.apiKey?.sourceId) {
    throw new ForbiddenError('This endpoint requires a source-scoped API key');
  }
}

/**
 * Middleware that requires an admin API key.
 */
export async function requireAdminKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireApiKey(request, reply);

  if (request.apiKey?.keyType !== 'admin') {
    throw new ForbiddenError('This endpoint requires an admin API key');
  }
}

/**
 * Middleware that verifies the source ID in the request matches the API key's source.
 * Use after requireSourceKey.
 */
export function requireMatchingSource(sourceIdParam: string = 'source_id') {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const body = request.body as Record<string, unknown> | undefined;
    const params = request.params as Record<string, unknown>;

    const sourceId = body?.[sourceIdParam] || params?.[sourceIdParam];

    if (!sourceId) {
      return; // No source ID to check
    }

    if (request.apiKey?.sourceId && request.apiKey.sourceId !== sourceId) {
      throw new ForbiddenError('API key does not have access to this source');
    }
  };
}
