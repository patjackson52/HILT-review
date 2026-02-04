import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, sources } from '../db/schema.js';
import { createHash, randomBytes } from 'crypto';

export interface ApiKeyInfo {
  id: string;
  sourceId: string | null;
  keyType: 'source' | 'admin';
  environment: 'live' | 'test';
  name: string | null;
}

export class ApiKeyService {
  /**
   * Generate a new API key.
   * Returns the raw key (only shown once) and the stored record.
   */
  async generate(options: {
    sourceId?: string;
    keyType: 'source' | 'admin';
    environment: 'live' | 'test';
    name?: string;
  }): Promise<{ key: string; record: ApiKeyInfo }> {
    // Generate key: prefix_randomBytes
    const prefix = options.environment === 'live' ? 'hilt_live' : 'hilt_test';
    const randomPart = randomBytes(24).toString('base64url');
    const key = `${prefix}_${randomPart}`;

    const keyPrefix = key.substring(0, 12);
    const keyHash = this.hashKey(key);

    const [record] = await db.insert(apiKeys).values({
      sourceId: options.sourceId,
      keyPrefix,
      keyHash,
      keyType: options.keyType,
      environment: options.environment,
      name: options.name,
    }).returning();

    return {
      key,
      record: {
        id: record.id,
        sourceId: record.sourceId,
        keyType: record.keyType as 'source' | 'admin',
        environment: record.environment as 'live' | 'test',
        name: record.name,
      },
    };
  }

  /**
   * Validate an API key and return its info if valid.
   * Returns null if invalid or revoked.
   */
  async validate(key: string): Promise<ApiKeyInfo | null> {
    const keyPrefix = key.substring(0, 12);
    const keyHash = this.hashKey(key);

    const [record] = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.keyPrefix, keyPrefix),
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt)
      ));

    if (!record) {
      return null;
    }

    // Update last used timestamp
    await db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, record.id));

    return {
      id: record.id,
      sourceId: record.sourceId,
      keyType: record.keyType as 'source' | 'admin',
      environment: record.environment as 'live' | 'test',
      name: record.name,
    };
  }

  /**
   * Revoke an API key.
   */
  async revoke(id: string): Promise<void> {
    await db.update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  /**
   * List API keys for a source (does not include the actual keys).
   */
  async listBySource(sourceId: string): Promise<ApiKeyInfo[]> {
    const records = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.sourceId, sourceId),
        isNull(apiKeys.revokedAt)
      ));

    return records.map(r => ({
      id: r.id,
      sourceId: r.sourceId,
      keyType: r.keyType as 'source' | 'admin',
      environment: r.environment as 'live' | 'test',
      name: r.name,
    }));
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}

export const apiKeyService = new ApiKeyService();
