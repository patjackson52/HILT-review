import { FastifyInstance } from 'fastify';
import { sourcesRoutes } from './sources.js';
import { reviewTasksRoutes } from './review-tasks.js';
import { decisionEventsRoutes } from './decision-events.js';
import { authRoutes } from './auth.js';

export async function registerRoutes(app: FastifyInstance) {
  // API v1 routes
  await app.register(async (api) => {
    await api.register(authRoutes);
    await api.register(sourcesRoutes);
    await api.register(reviewTasksRoutes);
    await api.register(decisionEventsRoutes);
  }, { prefix: '/api/v1' });
}
