import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { FastifyInstance } from 'fastify';
import { db } from '../../src/db/index.js';
import { apiKeys, sources, reviewTasks, decisionEvents } from '../../src/db/schema.js';
import { apiKeyService } from '../../src/services/api-key.service.js';

describe('Admin API', () => {
  let app: FastifyInstance;
  let adminKey: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.delete(decisionEvents);
    await db.delete(reviewTasks);
    await db.delete(apiKeys);
    await db.delete(sources);

    // Create an admin key for auth
    const result = await apiKeyService.generate({
      keyType: 'admin',
      environment: 'test',
      name: 'Test Admin',
    });
    adminKey = result.key;
  });

  describe('POST /api/v1/admin/api-keys', () => {
    it('should generate a new admin API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/api-keys',
        headers: { Authorization: `Bearer ${adminKey}` },
        payload: {
          key_type: 'admin',
          environment: 'test',
          name: 'New Admin Key',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.key).toMatch(/^hilt_test_/);
      expect(body.key_type).toBe('admin');
      expect(body.name).toBe('New Admin Key');
    });

    it('should generate a source-scoped API key', async () => {
      // Create a source first
      const [source] = await db.insert(sources).values({
        name: 'Test Source',
        deliveryMode: 'WEBHOOK_AND_PULL',
        webhookEnabled: true,
      }).returning();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/api-keys',
        headers: { Authorization: `Bearer ${adminKey}` },
        payload: {
          source_id: source.id,
          key_type: 'source',
          environment: 'live',
          name: 'Source Key',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.key).toMatch(/^hilt_live_/);
      expect(body.source_id).toBe(source.id);
      expect(body.key_type).toBe('source');
    });

    it('should reject requests without admin key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/api-keys',
        payload: {
          key_type: 'admin',
          environment: 'test',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests with non-admin key', async () => {
      const [source] = await db.insert(sources).values({
        name: 'Test Source',
        deliveryMode: 'PULL_ONLY',
        webhookEnabled: false,
      }).returning();

      const { key: sourceKey } = await apiKeyService.generate({
        sourceId: source.id,
        keyType: 'source',
        environment: 'test',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/api-keys',
        headers: { Authorization: `Bearer ${sourceKey}` },
        payload: {
          key_type: 'admin',
          environment: 'test',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/admin/sources/:sourceId/api-keys', () => {
    it('should list API keys for a source', async () => {
      const [source] = await db.insert(sources).values({
        name: 'Test Source',
        deliveryMode: 'PULL_ONLY',
        webhookEnabled: false,
      }).returning();

      // Generate two keys for the source
      await apiKeyService.generate({
        sourceId: source.id,
        keyType: 'source',
        environment: 'test',
        name: 'Key 1',
      });
      await apiKeyService.generate({
        sourceId: source.id,
        keyType: 'source',
        environment: 'live',
        name: 'Key 2',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/sources/${source.id}/api-keys`,
        headers: { Authorization: `Bearer ${adminKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items).toHaveLength(2);
    });
  });

  describe('DELETE /api/v1/admin/api-keys/:id', () => {
    it('should revoke an API key', async () => {
      const { key, record } = await apiKeyService.generate({
        keyType: 'admin',
        environment: 'test',
        name: 'To Revoke',
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/api-keys/${record.id}`,
        headers: { Authorization: `Bearer ${adminKey}` },
      });

      expect(response.statusCode).toBe(204);

      // Verify the key is revoked
      const validated = await apiKeyService.validate(key);
      expect(validated).toBeNull();
    });
  });

  describe('GET /api/v1/admin/stats', () => {
    it('should return system stats', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/stats',
        headers: { Authorization: `Bearer ${adminKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tasks).toBeDefined();
      expect(body.tasks.by_status).toBeDefined();
      expect(body.tasks.total).toBeTypeOf('number');
      expect(body.sources).toBeDefined();
      expect(body.sources.total).toBeTypeOf('number');
      expect(body.decision_events).toBeDefined();
      expect(body.decision_events.pending_delivery).toBeTypeOf('number');
      expect(body.api_keys).toBeDefined();
      expect(body.api_keys.active).toBeTypeOf('number');
    });
  });
});
