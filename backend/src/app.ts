import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGIN || true,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: config.NODE_ENV === 'test' ? ['127.0.0.1'] : [],
  });

  // Cookie and session support
  await app.register(cookie);
  await app.register(session, {
    secret: config.SESSION_SECRET || 'dev-secret-must-be-at-least-32-chars-long',
    cookie: {
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    },
    saveUninitialized: false,
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Root route
  app.get('/', async () => {
    return { service: 'hilt-review-api', status: 'ok', timestamp: new Date().toISOString() };
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register API routes
  await registerRoutes(app);

  return app;
}
