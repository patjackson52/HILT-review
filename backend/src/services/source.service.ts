import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sources } from '../db/schema.js';
import { NotFoundError } from '../domain/errors.js';
import type { CreateSourceInput } from '../domain/schemas.js';
import type { Source, SourceDeliveryConfig } from '@hilt-review/shared';

export class SourceService {
  async create(input: CreateSourceInput): Promise<Source> {
    const [source] = await db.insert(sources).values({
      name: input.name,
      description: input.description,
      deliveryMode: input.delivery.mode,
      webhookEnabled: input.delivery.webhook.enabled,
      webhookUrl: input.delivery.webhook.url,
      webhookSecret: input.delivery.webhook.secret,
      webhookTimeoutMs: input.delivery.webhook.timeout_ms,
      webhookMaxAttempts: input.delivery.webhook.max_attempts,
      webhookRetryBackoffSeconds: input.delivery.webhook.retry_backoff_seconds,
    }).returning();

    return this.toSource(source);
  }

  async getById(id: string): Promise<Source> {
    const [source] = await db.select().from(sources).where(eq(sources.id, id));

    if (!source) {
      throw new NotFoundError('Source', id);
    }

    return this.toSource(source);
  }

  async list(): Promise<Source[]> {
    const results = await db.select().from(sources).orderBy(sources.createdAt);
    return results.map(s => this.toSource(s));
  }

  async update(id: string, input: Partial<CreateSourceInput>): Promise<Source> {
    // First check if exists
    await this.getById(id);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;

    if (input.delivery) {
      if (input.delivery.mode !== undefined) updateData.deliveryMode = input.delivery.mode;
      if (input.delivery.webhook) {
        if (input.delivery.webhook.enabled !== undefined) updateData.webhookEnabled = input.delivery.webhook.enabled;
        if (input.delivery.webhook.url !== undefined) updateData.webhookUrl = input.delivery.webhook.url;
        if (input.delivery.webhook.secret !== undefined) updateData.webhookSecret = input.delivery.webhook.secret;
        if (input.delivery.webhook.timeout_ms !== undefined) updateData.webhookTimeoutMs = input.delivery.webhook.timeout_ms;
        if (input.delivery.webhook.max_attempts !== undefined) updateData.webhookMaxAttempts = input.delivery.webhook.max_attempts;
        if (input.delivery.webhook.retry_backoff_seconds !== undefined) updateData.webhookRetryBackoffSeconds = input.delivery.webhook.retry_backoff_seconds;
      }
    }

    const [updated] = await db.update(sources)
      .set(updateData)
      .where(eq(sources.id, id))
      .returning();

    return this.toSource(updated);
  }

  async delete(id: string): Promise<void> {
    // First check if exists
    await this.getById(id);

    await db.delete(sources).where(eq(sources.id, id));
  }

  private toSource(row: typeof sources.$inferSelect): Source {
    const delivery: SourceDeliveryConfig = {
      mode: row.deliveryMode,
      webhook: {
        enabled: row.webhookEnabled,
        url: row.webhookUrl ?? undefined,
        secret: row.webhookSecret ?? undefined,
        timeout_ms: row.webhookTimeoutMs ?? undefined,
        max_attempts: row.webhookMaxAttempts ?? undefined,
        retry_backoff_seconds: row.webhookRetryBackoffSeconds ?? undefined,
      },
    };

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      delivery,
      created_at: row.createdAt.toISOString(),
    };
  }
}

export const sourceService = new SourceService();
