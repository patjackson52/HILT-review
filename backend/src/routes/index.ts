import { FastifyInstance } from 'fastify';
import { sourcesRoutes } from './sources.js';

export async function registerRoutes(app: FastifyInstance) {
  // API v1 routes
  await app.register(async (api) => {
    await api.register(sourcesRoutes);
  }, { prefix: '/api/v1' });
}
