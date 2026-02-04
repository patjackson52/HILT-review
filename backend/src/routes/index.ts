import { FastifyInstance } from 'fastify';
import { sourcesRoutes } from './sources.js';
import { reviewTasksRoutes } from './review-tasks.js';

export async function registerRoutes(app: FastifyInstance) {
  // API v1 routes
  await app.register(async (api) => {
    await api.register(sourcesRoutes);
    await api.register(reviewTasksRoutes);
  }, { prefix: '/api/v1' });
}
