import { FastifyRequest, FastifyReply } from 'fastify';
import { apiKeyService, ApiKeyInfo } from '../services/api-key.service.js';
import { UnauthorizedError, ForbiddenError } from '../domain/errors.js';
import { config } from '../config/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyInfo;
    userId?: string;
  }
}

/**
 * Middleware that requires a valid session (user login).
 * In development and test modes, allows unauthenticated access for easier testing.
 */
export async function requireSession(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // In development or test mode, allow unauthenticated access
  if ((config.NODE_ENV === 'development' || config.NODE_ENV === 'test') && !request.session?.userId) {
    request.userId = 'dev-user';
    return;
  }

  if (!request.session?.userId) {
    throw new UnauthorizedError('Authentication required. Please log in.');
  }

  request.userId = request.session.userId;
}

/**
 * Middleware that optionally extracts user from session.
 * Does not require authentication but provides user info if available.
 */
export async function optionalSession(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (request.session?.userId) {
    request.userId = request.session.userId;
  } else if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
    request.userId = 'dev-user';
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
