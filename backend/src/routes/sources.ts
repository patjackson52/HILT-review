import { FastifyInstance } from 'fastify';
import { sourceService } from '../services/source.service.js';
import { CreateSourceSchema } from '../domain/schemas.js';

export async function sourcesRoutes(app: FastifyInstance) {
  // Create source
  app.post('/sources', async (request, reply) => {
    const input = CreateSourceSchema.parse(request.body);
    const source = await sourceService.create(input);
    return reply.status(201).send(source);
  });

  // Get source by ID
  app.get<{ Params: { id: string } }>('/sources/:id', async (request) => {
    return sourceService.getById(request.params.id);
  });

  // List all sources
  app.get('/sources', async () => {
    return sourceService.list();
  });

  // Update source
  app.patch<{ Params: { id: string } }>('/sources/:id', async (request) => {
    const input = CreateSourceSchema.partial().parse(request.body);
    return sourceService.update(request.params.id, input);
  });

  // Delete source
  app.delete<{ Params: { id: string } }>('/sources/:id', async (request, reply) => {
    await sourceService.delete(request.params.id);
    return reply.status(204).send();
  });
}
