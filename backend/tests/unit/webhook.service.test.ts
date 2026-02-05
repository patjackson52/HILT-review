import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webhookService } from '../../src/services/webhook.service.js';

describe('WebhookService', () => {
  describe('calculateRetryDelay', () => {
    it('should apply exponential backoff', () => {
      const base = 30; // 30 seconds
      // Stub Math.random to remove jitter
      vi.spyOn(Math, 'random').mockReturnValue(0);

      expect(webhookService.calculateRetryDelay(0, base)).toBe(30 * 1000);  // 30s
      expect(webhookService.calculateRetryDelay(1, base)).toBe(60 * 1000);  // 60s
      expect(webhookService.calculateRetryDelay(2, base)).toBe(120 * 1000); // 120s
      expect(webhookService.calculateRetryDelay(3, base)).toBe(240 * 1000); // 240s

      vi.restoreAllMocks();
    });

    it('should cap delay at 1 hour', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);

      // 30 * 2^8 = 7680 seconds, should be capped at 3600
      const delay = webhookService.calculateRetryDelay(8, 30);
      expect(delay).toBe(3600 * 1000);

      vi.restoreAllMocks();
    });

    it('should add jitter up to 10% of delay', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1); // Max jitter

      // base=30, attempt=0: delay=30s, jitter=10% of 30=3s, total=33s
      const delay = webhookService.calculateRetryDelay(0, 30);
      expect(delay).toBe(33 * 1000);

      vi.restoreAllMocks();
    });
  });

  describe('sendWebhook', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return error when no webhook URL is configured', async () => {
      const result = await webhookService.sendWebhook(
        { webhookUrl: null, webhookSecret: null, webhookTimeoutMs: null },
        {} as any,
        'event-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No webhook URL configured');
      expect(result.retryable).toBe(false);
    });

    it('should return success for 2xx responses', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('OK', { status: 200 })
      );

      const result = await webhookService.sendWebhook(
        { webhookUrl: 'https://example.com/webhook', webhookSecret: 'secret', webhookTimeoutMs: 5000 },
        {} as any,
        'event-123'
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('should set correct headers including HMAC signature', async () => {
      let capturedHeaders: Record<string, string> = {};
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const headers = init?.headers as Record<string, string>;
        capturedHeaders = headers;
        return new Response('OK', { status: 200 });
      });

      await webhookService.sendWebhook(
        { webhookUrl: 'https://example.com/webhook', webhookSecret: 'test-secret', webhookTimeoutMs: 5000 },
        {} as any,
        'event-456'
      );

      expect(capturedHeaders['Content-Type']).toBe('application/json');
      expect(capturedHeaders['X-HILT-Signature']).toMatch(/^sha256=[a-f0-9]+$/);
      expect(capturedHeaders['X-HILT-Event-ID']).toBe('event-456');
      expect(capturedHeaders['X-HILT-Event-Type']).toBe('decision');
    });

    it('should send empty signature when no secret is configured', async () => {
      let capturedHeaders: Record<string, string> = {};
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return new Response('OK', { status: 200 });
      });

      await webhookService.sendWebhook(
        { webhookUrl: 'https://example.com/webhook', webhookSecret: null, webhookTimeoutMs: 5000 },
        {} as any,
        'event-789'
      );

      expect(capturedHeaders['X-HILT-Signature']).toBe('');
    });

    it('should mark 5xx errors as retryable', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Server Error', { status: 503 })
      );

      const result = await webhookService.sendWebhook(
        { webhookUrl: 'https://example.com/webhook', webhookSecret: null, webhookTimeoutMs: 5000 },
        {} as any,
        'event-123'
      );

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should mark 429 (rate limit) as retryable', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Too Many Requests', { status: 429 })
      );

      const result = await webhookService.sendWebhook(
        { webhookUrl: 'https://example.com/webhook', webhookSecret: null, webhookTimeoutMs: 5000 },
        {} as any,
        'event-123'
      );

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should mark 4xx errors (except 429) as non-retryable', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Bad Request', { status: 400 })
      );

      const result = await webhookService.sendWebhook(
        { webhookUrl: 'https://example.com/webhook', webhookSecret: null, webhookTimeoutMs: 5000 },
        {} as any,
        'event-123'
      );

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    });

    it('should handle network errors as retryable', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await webhookService.sendWebhook(
        { webhookUrl: 'https://example.com/webhook', webhookSecret: null, webhookTimeoutMs: 5000 },
        {} as any,
        'event-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
      expect(result.retryable).toBe(true);
    });
  });
});
