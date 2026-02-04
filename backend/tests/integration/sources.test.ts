import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { FastifyInstance } from 'fastify';
import { db } from '../../src/db/index.js';
import { sources } from '../../src/db/schema.js';

describe('Sources API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up sources table before each test
    await db.delete(sources);
  });

  const validSource = {
    name: 'Test Agent',
    description: 'A test agent source',
    delivery: {
      mode: 'WEBHOOK_AND_PULL' as const,
      webhook: {
        enabled: true,
        url: 'https://example.com/webhook',
        timeout_ms: 5000,
        max_attempts: 10,
        retry_backoff_seconds: 30,
      },
    },
  };

  describe('POST /api/v1/sources', () => {
    it('should create a source', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sources',
        payload: validSource,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.id).toBeDefined();
      expect(body.name).toBe(validSource.name);
      expect(body.description).toBe(validSource.description);
      expect(body.delivery.mode).toBe(validSource.delivery.mode);
      expect(body.delivery.webhook.enabled).toBe(true);
    });

    it('should reject invalid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sources',
        payload: { name: 'Missing delivery' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/sources/:id', () => {
    it('should return a source by ID', async () => {
      // Create a source first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/sources',
        payload: validSource,
      });
      const created = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/sources/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.id).toBe(created.id);
      expect(body.name).toBe(validSource.name);
    });

    it('should return 404 for non-existent source', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sources/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/sources', () => {
    it('should list all sources', async () => {
      // Create two sources
      await app.inject({
        method: 'POST',
        url: '/api/v1/sources',
        payload: validSource,
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/sources',
        payload: { ...validSource, name: 'Second Agent' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sources',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
    });
  });

  describe('PATCH /api/v1/sources/:id', () => {
    it('should update a source', async () => {
      // Create a source first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/sources',
        payload: validSource,
      });
      const created = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sources/${created.id}`,
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe('Updated Name');
      expect(body.description).toBe(validSource.description); // unchanged
    });
  });

  describe('DELETE /api/v1/sources/:id', () => {
    it('should delete a source', async () => {
      // Create a source first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/sources',
        payload: validSource,
      });
      const created = JSON.parse(createResponse.payload);

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sources/${created.id}`,
      });

      expect(deleteResponse.statusCode).toBe(204);

      // Verify it's deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/sources/${created.id}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });
  });
});
