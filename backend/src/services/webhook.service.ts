import crypto from 'crypto';
import type { Source, DecisionEvent } from '@hilt-review/shared';

interface WebhookPayload {
  event_id: string;
  event_type: 'decision';
  timestamp: string;
  payload: DecisionEvent;
}

interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  retryable: boolean;
}

export class WebhookService {
  /**
   * Send a webhook to a source's configured URL
   */
  async sendWebhook(
    source: {
      webhookUrl: string | null;
      webhookSecret: string | null;
      webhookTimeoutMs: number | null;
    },
    event: DecisionEvent,
    eventId: string
  ): Promise<WebhookResult> {
    if (!source.webhookUrl) {
      return {
        success: false,
        error: 'No webhook URL configured',
        retryable: false,
      };
    }

    const webhookPayload: WebhookPayload = {
      event_id: eventId,
      event_type: 'decision',
      timestamp: new Date().toISOString(),
      payload: event,
    };

    const body = JSON.stringify(webhookPayload);
    const signature = this.generateSignature(body, source.webhookSecret);

    const timeout = source.webhookTimeoutMs ?? 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(source.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HILT-Signature': signature,
          'X-HILT-Event-ID': eventId,
          'X-HILT-Event-Type': 'decision',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true, statusCode: response.status, retryable: false };
      }

      // 4xx errors are not retryable (except 429)
      const retryable = response.status >= 500 || response.status === 429;

      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
        retryable,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Network errors and timeouts are retryable
      const retryable = errorMessage.includes('abort') ||
                        errorMessage.includes('timeout') ||
                        errorMessage.includes('network') ||
                        errorMessage.includes('ECONNREFUSED');

      return {
        success: false,
        error: errorMessage,
        retryable,
      };
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string | null): string {
    if (!secret) {
      return '';
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Calculate next retry delay using exponential backoff
   */
  calculateRetryDelay(attempt: number, baseBackoffSeconds: number): number {
    // Exponential backoff: base * 2^attempt, capped at 1 hour
    const delaySeconds = Math.min(
      baseBackoffSeconds * Math.pow(2, attempt),
      3600
    );
    // Add jitter (up to 10% of delay)
    const jitter = Math.random() * 0.1 * delaySeconds;
    return Math.floor((delaySeconds + jitter) * 1000);
  }
}

export const webhookService = new WebhookService();
