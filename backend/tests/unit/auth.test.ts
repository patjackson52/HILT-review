import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { FastifyInstance } from 'fastify';
import { db } from '../../src/db/index.js';
import { apiKeys, sources } from '../../src/db/schema.js';
import { apiKeyService } from '../../src/services/api-key.service.js';

describe('API Key Authentication', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    // Add a protected test route
    app.get('/api/v1/test-auth', {
      preHandler: [async (request, reply) => {
        const { requireApiKey } = await import('../../src/middleware/auth.js');
        await requireApiKey(request, reply);
      }],
    }, async (request) => {
      return { authenticated: true, keyInfo: request.apiKey };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.delete(apiKeys);
    await db.delete(sources);
  });

  describe('ApiKeyService', () => {
    it('should generate and validate API keys', async () => {
      const { key, record } = await apiKeyService.generate({
        keyType: 'admin',
        environment: 'test',
        name: 'Test Key',
      });

      expect(key).toMatch(/^hilt_test_/);
      expect(record.keyType).toBe('admin');
      expect(record.environment).toBe('test');

      // Validate the key
      const validated = await apiKeyService.validate(key);
      expect(validated).not.toBeNull();
      expect(validated?.id).toBe(record.id);
    });

    it('should return null for invalid keys', async () => {
      const result = await apiKeyService.validate('invalid_key_123');
      expect(result).toBeNull();
    });

    it('should return null for revoked keys', async () => {
      const { key, record } = await apiKeyService.generate({
        keyType: 'admin',
        environment: 'test',
      });

      await apiKeyService.revoke(record.id);

      const result = await apiKeyService.validate(key);
      expect(result).toBeNull();
    });

    it('should generate live keys with correct prefix', async () => {
      const { key } = await apiKeyService.generate({
        keyType: 'admin',
        environment: 'live',
      });

      expect(key).toMatch(/^hilt_live_/);
    });

    it('should associate keys with sources', async () => {
      // Create a source first
      const [source] = await db.insert(sources).values({
        name: 'Test Source',
        deliveryMode: 'WEBHOOK_AND_PULL',
        webhookEnabled: true,
      }).returning();

      const { key, record } = await apiKeyService.generate({
        sourceId: source.id,
        keyType: 'source',
        environment: 'test',
      });

      expect(record.sourceId).toBe(source.id);
      expect(record.keyType).toBe('source');

      const validated = await apiKeyService.validate(key);
      expect(validated?.sourceId).toBe(source.id);
    });
  });

  describe('requireApiKey middleware', () => {
    it('should reject requests without Authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test-auth',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests with invalid key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test-auth',
        headers: {
          Authorization: 'Bearer invalid_key',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept requests with valid key', async () => {
      const { key } = await apiKeyService.generate({
        keyType: 'admin',
        environment: 'test',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test-auth',
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.authenticated).toBe(true);
      expect(body.keyInfo.keyType).toBe('admin');
    });

    it('should reject malformed Authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test-auth',
        headers: {
          Authorization: 'Basic somekey',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
