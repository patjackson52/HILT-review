import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { FastifyInstance } from 'fastify';
import { db } from '../../src/db/index.js';
import { sources, reviewTasks, apiKeys } from '../../src/db/schema.js';
import { apiKeyService } from '../../src/services/api-key.service.js';

describe('Review Tasks API', () => {
  let app: FastifyInstance;
  let sourceId: string;
  let apiKey: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up tables
    await db.delete(reviewTasks);
    await db.delete(apiKeys);
    await db.delete(sources);

    // Create a source
    const [source] = await db.insert(sources).values({
      name: 'Test Agent',
      deliveryMode: 'WEBHOOK_AND_PULL',
      webhookEnabled: true,
    }).returning();
    sourceId = source.id;

    // Create API key for the source
    const { key } = await apiKeyService.generate({
      sourceId,
      keyType: 'source',
      environment: 'test',
    });
    apiKey = key;
  });

  const validTask = () => ({
    source_id: sourceId,
    title: 'Send Email to Customer',
    service: { id: 'email', name: 'Email Service' },
    action: { type: 'send' as const, verb: 'Send Email' },
    risk_level: 'medium' as const,
    risk_warning: 'This will send an email to a customer',
    blocks: [
      {
        id: 'email-body',
        label: 'Email Body',
        type: 'markdown' as const,
        content: '# Hello\n\nThis is a test email.',
        editable: true,
      },
    ],
  });

  describe('POST /api/v1/review-tasks', () => {
    it('should create a review task', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/review-tasks',
        headers: { Authorization: `Bearer ${apiKey}` },
        payload: validTask(),
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.id).toBeDefined();
      expect(body.title).toBe('Send Email to Customer');
      expect(body.status).toBe('PENDING');
      expect(body.service.id).toBe('email');
      expect(body.action.type).toBe('send');
      expect(body.risk_level).toBe('medium');
      expect(body.blocks_original).toHaveLength(1);
      expect(body.blocks_working).toHaveLength(1);
    });

    it('should require API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/review-tasks',
        payload: validTask(),
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject source_id that does not match API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/review-tasks',
        headers: { Authorization: `Bearer ${apiKey}` },
        payload: {
          ...validTask(),
          source_id: '00000000-0000-0000-0000-000000000000',
        },
      });

      // Source-scoped API key cannot create tasks for other sources
      expect(response.statusCode).toBe(403);
    });

    it('should generate preview from first block', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/review-tasks',
        headers: { Authorization: `Bearer ${apiKey}` },
        payload: validTask(),
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.preview).toBeDefined();
      expect(body.preview).toContain('Hello');
    });
  });

  describe('GET /api/v1/review-tasks/:id', () => {
    it('should return a review task by ID', async () => {
      // Create a task first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/review-tasks',
        headers: { Authorization: `Bearer ${apiKey}` },
        payload: validTask(),
      });
      const created = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/review-tasks/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.id).toBe(created.id);
      expect(body.title).toBe('Send Email to Customer');
      expect(body.source_name).toBe('Test Agent');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/review-tasks/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/review-tasks', () => {
    it('should list review tasks', async () => {
      // Create two tasks
      await app.inject({
        method: 'POST',
        url: '/api/v1/review-tasks',
        headers: { Authorization: `Bearer ${apiKey}` },
        payload: validTask(),
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/review-tasks',
        headers: { Authorization: `Bearer ${apiKey}` },
        payload: { ...validTask(), title: 'Second Task' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/review-tasks',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items).toHaveLength(2);
      expect(body.total_count).toBe(2);
    });

    it('should filter by source_id', async () => {
      // Create a task
      await app.inject({
        method: 'POST',
        url: '/api/v1/review-tasks',
        headers: { Authorization: `Bearer ${apiKey}` },
        payload: validTask(),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/review-tasks?source_id=${sourceId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.every((t: { source_id: string }) => t.source_id === sourceId)).toBe(true);
    });

    it('should filter by status', async () => {
      // Create a task
      await app.inject({
        method: 'POST',
        url: '/api/v1/review-tasks',
        headers: { Authorization: `Bearer ${apiKey}` },
        payload: validTask(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/review-tasks?status=PENDING',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items.every((t: { status: string }) => t.status === 'PENDING')).toBe(true);
    });
  });
});
