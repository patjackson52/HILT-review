# HILT-Review Testing Strategy

This document outlines the testing strategy for HILT-Review, covering unit tests, integration tests, developer workflows, test data management, and strategies for separating test data from production data.

---

## 1. Testing Pyramid

```
                    ┌─────────────┐
                    │    E2E      │  ← Few, slow, high confidence
                    │   Tests     │
                    ├─────────────┤
                    │ Integration │  ← API routes, DB queries
                    │   Tests     │
                    ├─────────────┤
                    │    Unit     │  ← Fast, isolated, many
                    │   Tests     │
                    └─────────────┘
```

| Level | Scope | Tools | Count |
|-------|-------|-------|-------|
| **Unit** | Services, utilities, domain logic | Vitest | Many (70%) |
| **Integration** | API routes, database, workers | Vitest + Supertest | Medium (25%) |
| **E2E** | Full user flows | Playwright | Few (5%) |

---

## 2. Test Configuration

### Directory Structure

```
backend/
├── tests/
│   ├── setup.ts              # Global test setup
│   ├── helpers/
│   │   ├── db.ts             # Test database utilities
│   │   ├── factories.ts      # Test data factories
│   │   ├── fixtures.ts       # Static test fixtures
│   │   └── mocks.ts          # Service mocks
│   │
│   ├── unit/
│   │   ├── services/
│   │   │   ├── diff.service.test.ts
│   │   │   ├── decision.service.test.ts
│   │   │   └── webhook.service.test.ts
│   │   └── utils/
│   │       ├── crypto.test.ts
│   │       └── pagination.test.ts
│   │
│   └── integration/
│       ├── routes/
│       │   ├── sources.test.ts
│       │   ├── review-tasks.test.ts
│       │   └── auth.test.ts
│       └── workers/
│           └── decision-dispatcher.test.ts

frontend/
├── tests/
│   ├── setup.ts
│   ├── unit/
│   │   └── components/
│   └── integration/
│       └── pages/
```

### Vitest Configuration

```typescript
// backend/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['tests/**', 'drizzle/**'],
    },
    // Separate integration tests for isolated DB
    poolOptions: {
      threads: {
        singleThread: true, // Avoid parallel DB conflicts
      },
    },
  },
});
```

---

## 3. Test Database Strategy

### Same Database, Test Isolation

All test data lives in the **same database** as real data, isolated by:
1. **Test users** with specific email patterns
2. **Test sources** with naming conventions
3. **Test flags** on records

### Test User Convention

```typescript
// Test users identified by email pattern
const TEST_USER_PATTERN = /^test\+.*@hilt-review\.test$/;

// Examples:
// test+reviewer1@hilt-review.test
// test+admin@hilt-review.test
// test+alice@hilt-review.test

function isTestUser(email: string): boolean {
  return TEST_USER_PATTERN.test(email);
}
```

### Test Source Convention

```typescript
// Test sources identified by name prefix
const TEST_SOURCE_PREFIX = 'test-';

// Examples:
// test-agent-1
// test-ci-pipeline
// test-manual

function isTestSource(name: string): boolean {
  return name.startsWith(TEST_SOURCE_PREFIX);
}
```

### Database Schema Addition

```sql
-- Add is_test flag to sources table
ALTER TABLE sources ADD COLUMN is_test BOOLEAN DEFAULT FALSE;

-- Add index for filtering
CREATE INDEX idx_sources_is_test ON sources(is_test);

-- Test sources are automatically marked
CREATE OR REPLACE FUNCTION mark_test_source()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name LIKE 'test-%' THEN
    NEW.is_test := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mark_test_source
  BEFORE INSERT ON sources
  FOR EACH ROW EXECUTE FUNCTION mark_test_source();
```

### Test Data Cleanup

```typescript
// scripts/cleanup-test-data.ts
import { db } from '../src/db';
import { sources, reviewTasks, decisionEvents } from '../src/db/schema';
import { like, eq } from 'drizzle-orm';

async function cleanupTestData(olderThanDays: number = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  // Delete old test decision events
  await db.delete(decisionEvents)
    .where(like(reviewTasks.source_id, 'test-%'));

  // Delete old test review tasks
  await db.delete(reviewTasks)
    .where(eq(sources.is_test, true));

  // Optionally: Delete test sources older than cutoff
  await db.delete(sources)
    .where(eq(sources.is_test, true))
    .where(lt(sources.created_at, cutoff));

  console.log('Test data cleanup complete');
}
```

---

## 4. Test Data Factories

### Factory Pattern

```typescript
// tests/helpers/factories.ts
import { faker } from '@faker-js/faker';
import { db } from '../../src/db';
import { sources, reviewTasks, artifactBlocks } from '../../src/db/schema';
import type { Source, ReviewTask, ArtifactBlock } from '../../src/domain/types';

// Seed for deterministic tests
faker.seed(12345);

// ─────────────────────────────────────────────────────────────
// Source Factory
// ─────────────────────────────────────────────────────────────

interface SourceOverrides {
  name?: string;
  webhook_url?: string;
  delivery_mode?: 'webhook' | 'pull';
}

export async function createTestSource(overrides: SourceOverrides = {}): Promise<Source> {
  const source = {
    id: faker.string.uuid(),
    name: overrides.name ?? `test-${faker.word.noun()}-${faker.string.alphanumeric(4)}`,
    webhook_url: overrides.webhook_url ?? `https://webhook.site/${faker.string.uuid()}`,
    delivery_mode: overrides.delivery_mode ?? 'pull',
    api_key_hash: await hashApiKey(`test-key-${faker.string.alphanumeric(16)}`),
    webhook_secret: faker.string.alphanumeric(32),
    is_test: true,
    created_at: new Date(),
  };

  const [created] = await db.insert(sources).values(source).returning();
  return created;
}

// ─────────────────────────────────────────────────────────────
// Review Task Factory
// ─────────────────────────────────────────────────────────────

interface ReviewTaskOverrides {
  source_id?: string;
  status?: 'PENDING' | 'APPROVED' | 'DENIED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  summary?: string;
  blocks?: Partial<ArtifactBlock>[];
}

export async function createTestReviewTask(
  overrides: ReviewTaskOverrides = {}
): Promise<ReviewTask> {
  // Create source if not provided
  const sourceId = overrides.source_id ?? (await createTestSource()).id;

  const task = {
    id: faker.string.uuid(),
    source_id: sourceId,
    status: overrides.status ?? 'PENDING',
    priority: overrides.priority ?? 'NORMAL',
    summary: overrides.summary ?? faker.lorem.sentence(),
    idempotency_key: `test-${faker.string.uuid()}`,
    metadata: { test: true },
    created_at: new Date(),
    updated_at: new Date(),
  };

  const [created] = await db.insert(reviewTasks).values(task).returning();

  // Create default blocks if not specified
  const blocks = overrides.blocks ?? [
    { type: 'markdown', original_content: faker.lorem.paragraphs(2) },
  ];

  for (let i = 0; i < blocks.length; i++) {
    await createTestArtifactBlock({
      review_task_id: created.id,
      position: i,
      ...blocks[i],
    });
  }

  return created;
}

// ─────────────────────────────────────────────────────────────
// Artifact Block Factory
// ─────────────────────────────────────────────────────────────

interface ArtifactBlockOverrides {
  review_task_id: string;
  position?: number;
  type?: 'markdown' | 'plaintext' | 'json';
  original_content?: string;
  working_content?: string;
}

export async function createTestArtifactBlock(
  overrides: ArtifactBlockOverrides
): Promise<ArtifactBlock> {
  const type = overrides.type ?? 'markdown';
  const originalContent = overrides.original_content ?? generateContentByType(type);

  const block = {
    id: faker.string.uuid(),
    review_task_id: overrides.review_task_id,
    position: overrides.position ?? 0,
    type,
    original_content: originalContent,
    working_content: overrides.working_content ?? originalContent,
    schema: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const [created] = await db.insert(artifactBlocks).values(block).returning();
  return created;
}

function generateContentByType(type: string): string {
  switch (type) {
    case 'markdown':
      return `# ${faker.lorem.sentence()}\n\n${faker.lorem.paragraphs(2)}`;
    case 'json':
      return JSON.stringify({
        action: faker.word.verb(),
        target: faker.system.fileName(),
        params: { count: faker.number.int(100) },
      }, null, 2);
    case 'plaintext':
    default:
      return faker.lorem.paragraph();
  }
}

// ─────────────────────────────────────────────────────────────
// Batch Factories
// ─────────────────────────────────────────────────────────────

export async function createTestReviewTaskBatch(
  count: number,
  overrides: ReviewTaskOverrides = {}
): Promise<ReviewTask[]> {
  const tasks: ReviewTask[] = [];
  for (let i = 0; i < count; i++) {
    tasks.push(await createTestReviewTask(overrides));
  }
  return tasks;
}

// ─────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────

export async function cleanupTestSource(sourceId: string): Promise<void> {
  await db.delete(sources).where(eq(sources.id, sourceId));
}

export async function cleanupAllTestData(): Promise<void> {
  await db.delete(sources).where(eq(sources.is_test, true));
}
```

---

## 5. Static Fixtures

```typescript
// tests/helpers/fixtures.ts

// ─────────────────────────────────────────────────────────────
// Realistic test scenarios
// ─────────────────────────────────────────────────────────────

export const FIXTURES = {
  // Email send approval
  emailSendTask: {
    summary: 'Send marketing email to 500 subscribers',
    blocks: [
      {
        type: 'markdown' as const,
        original_content: `# Email Campaign: Summer Sale

**To:** 500 subscribers (marketing list)
**Subject:** Don't miss our Summer Sale - Up to 50% off!

---

Dear Customer,

We're excited to announce our biggest summer sale yet! For the next 72 hours, enjoy:

- 50% off all summer clothing
- 30% off outdoor furniture
- Free shipping on orders over $50

[Shop Now](https://example.com/summer-sale)

Best regards,
The Marketing Team`,
      },
      {
        type: 'json' as const,
        original_content: JSON.stringify({
          template_id: 'summer-sale-2024',
          recipient_list: 'marketing-subscribers',
          recipient_count: 500,
          send_at: '2024-07-15T10:00:00Z',
        }, null, 2),
      },
    ],
    execution_intent: {
      kind: 'http_request',
      display: {
        action_type: 'Send Email',
        target: '500 subscribers',
        warning: 'This will send emails to real customers',
      },
    },
  },

  // Code deployment approval
  deploymentTask: {
    summary: 'Deploy v2.3.1 to production',
    blocks: [
      {
        type: 'markdown' as const,
        original_content: `# Deployment Request

**Version:** v2.3.1
**Environment:** Production
**Changes:**

- Fixed authentication bug (#1234)
- Improved dashboard performance
- Updated dependencies

**Rollback Plan:** Revert to v2.3.0 tag`,
      },
      {
        type: 'json' as const,
        original_content: JSON.stringify({
          version: '2.3.1',
          environment: 'production',
          commit_sha: 'abc123def456',
          rollback_version: '2.3.0',
        }, null, 2),
      },
    ],
    execution_intent: {
      kind: 'command_template',
      display: {
        action_type: 'Deploy',
        target: 'production',
        icon: 'rocket',
      },
    },
  },

  // Database migration approval
  migrationTask: {
    summary: 'Run database migration: add user_preferences table',
    blocks: [
      {
        type: 'markdown' as const,
        original_content: `# Database Migration

**Migration:** 20240715_add_user_preferences
**Database:** production-db

## SQL to Execute

\`\`\`sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'light',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
\`\`\`

**Estimated Impact:** < 1 second, no downtime`,
      },
    ],
    execution_intent: {
      kind: 'command_template',
      display: {
        action_type: 'Run Migration',
        target: 'production-db',
        warning: 'Database schema change',
      },
    },
  },

  // Simple confirmation
  simpleConfirmTask: {
    summary: 'Restart background worker process',
    blocks: [
      {
        type: 'plaintext' as const,
        original_content: 'Restart the email-worker process on server prod-worker-01',
      },
    ],
    interaction_schema: {
      type: 'confirm',
    },
  },
};

// ─────────────────────────────────────────────────────────────
// Test Users
// ─────────────────────────────────────────────────────────────

export const TEST_USERS = {
  reviewer: {
    email: 'test+reviewer@hilt-review.test',
    name: 'Test Reviewer',
    google_id: 'test-google-id-reviewer',
  },
  admin: {
    email: 'test+admin@hilt-review.test',
    name: 'Test Admin',
    google_id: 'test-google-id-admin',
  },
  readonly: {
    email: 'test+readonly@hilt-review.test',
    name: 'Test Readonly',
    google_id: 'test-google-id-readonly',
  },
};

// ─────────────────────────────────────────────────────────────
// Test API Keys
// ─────────────────────────────────────────────────────────────

export const TEST_API_KEYS = {
  agent1: 'hilt_test_key_agent1_xxxxxxxxxxxxxxxx',
  agent2: 'hilt_test_key_agent2_xxxxxxxxxxxxxxxx',
  invalid: 'hilt_test_key_invalid_xxxxxxxxxxxxx',
};
```

---

## 6. Developer Testing Workflows

### 6.1 CLI Tool for Test Tasks

```typescript
// scripts/dev-tools/create-test-task.ts
#!/usr/bin/env tsx

import { program } from 'commander';
import { createTestSource, createTestReviewTask } from '../../tests/helpers/factories';
import { FIXTURES } from '../../tests/helpers/fixtures';

program
  .name('create-test-task')
  .description('Create test review tasks for development')
  .option('-t, --type <type>', 'Task type: email, deploy, migration, simple', 'email')
  .option('-c, --count <number>', 'Number of tasks to create', '1')
  .option('-s, --source <name>', 'Source name (creates if not exists)')
  .option('-p, --priority <level>', 'Priority: LOW, NORMAL, HIGH, URGENT', 'NORMAL')
  .option('--pending', 'Create in PENDING status (default)')
  .option('--approved', 'Create in APPROVED status')
  .option('--denied', 'Create in DENIED status');

program.parse();

const opts = program.opts();

async function main() {
  const source = await createTestSource({
    name: opts.source ?? `test-cli-${Date.now()}`,
  });

  console.log(`Created test source: ${source.name} (${source.id})`);

  const fixture = FIXTURES[`${opts.type}Task`] ?? FIXTURES.simpleConfirmTask;
  const count = parseInt(opts.count, 10);

  for (let i = 0; i < count; i++) {
    const task = await createTestReviewTask({
      source_id: source.id,
      status: opts.approved ? 'APPROVED' : opts.denied ? 'DENIED' : 'PENDING',
      priority: opts.priority,
      ...fixture,
    });

    console.log(`Created task ${i + 1}/${count}: ${task.id}`);
    console.log(`  Summary: ${task.summary}`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Priority: ${task.priority}`);
  }

  console.log('\nDone! View tasks at: http://localhost:5173/review');
}

main().catch(console.error);
```

### 6.2 NPM Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",

    "dev:seed": "tsx scripts/dev-tools/seed-test-data.ts",
    "dev:task": "tsx scripts/dev-tools/create-test-task.ts",
    "dev:cleanup": "tsx scripts/dev-tools/cleanup-test-data.ts",
    "dev:reset": "npm run dev:cleanup && npm run dev:seed"
  }
}
```

### 6.3 Seed Script

```typescript
// scripts/dev-tools/seed-test-data.ts
#!/usr/bin/env tsx

import { createTestSource, createTestReviewTask } from '../../tests/helpers/factories';
import { FIXTURES, TEST_API_KEYS } from '../../tests/helpers/fixtures';

async function seedTestData() {
  console.log('Seeding test data...\n');

  // Create test sources
  const sources = {
    agent1: await createTestSource({
      name: 'test-agent-email',
      delivery_mode: 'webhook',
      webhook_url: 'https://webhook.site/test-email-agent',
    }),
    agent2: await createTestSource({
      name: 'test-agent-deploy',
      delivery_mode: 'pull',
    }),
    agent3: await createTestSource({
      name: 'test-agent-migrations',
      delivery_mode: 'pull',
    }),
  };

  console.log('Created test sources:');
  Object.entries(sources).forEach(([key, source]) => {
    console.log(`  - ${source.name}: ${source.id}`);
  });

  // Create variety of tasks
  const tasks = [
    // Email tasks
    await createTestReviewTask({
      source_id: sources.agent1.id,
      priority: 'HIGH',
      ...FIXTURES.emailSendTask,
    }),
    await createTestReviewTask({
      source_id: sources.agent1.id,
      priority: 'NORMAL',
      ...FIXTURES.emailSendTask,
      summary: 'Send weekly newsletter',
    }),

    // Deployment tasks
    await createTestReviewTask({
      source_id: sources.agent2.id,
      priority: 'URGENT',
      ...FIXTURES.deploymentTask,
    }),

    // Migration tasks
    await createTestReviewTask({
      source_id: sources.agent3.id,
      priority: 'HIGH',
      ...FIXTURES.migrationTask,
    }),

    // Simple confirmations
    await createTestReviewTask({
      source_id: sources.agent2.id,
      priority: 'LOW',
      ...FIXTURES.simpleConfirmTask,
    }),

    // Some already decided
    await createTestReviewTask({
      source_id: sources.agent1.id,
      status: 'APPROVED',
      ...FIXTURES.emailSendTask,
    }),
    await createTestReviewTask({
      source_id: sources.agent2.id,
      status: 'DENIED',
      ...FIXTURES.deploymentTask,
    }),
  ];

  console.log(`\nCreated ${tasks.length} test tasks:`);
  tasks.forEach((task) => {
    console.log(`  - [${task.status}] ${task.priority}: ${task.summary.slice(0, 50)}...`);
  });

  console.log('\n✓ Test data seeded successfully');
  console.log('\nTest API keys:');
  Object.entries(TEST_API_KEYS).forEach(([name, key]) => {
    if (name !== 'invalid') {
      console.log(`  ${name}: ${key}`);
    }
  });
}

seedTestData().catch(console.error);
```

---

## 7. Unit Test Examples

### Service Test

```typescript
// tests/unit/services/diff.service.test.ts
import { describe, it, expect } from 'vitest';
import { DiffService } from '../../../src/services/diff.service';

describe('DiffService', () => {
  const diffService = new DiffService();

  describe('computeTextDiff', () => {
    it('returns empty diff for identical content', () => {
      const original = 'Hello, world!';
      const modified = 'Hello, world!';

      const diff = diffService.computeTextDiff(original, modified);

      expect(diff.hasChanges).toBe(false);
      expect(diff.hunks).toHaveLength(0);
    });

    it('detects single line change', () => {
      const original = 'Hello, world!';
      const modified = 'Hello, Claude!';

      const diff = diffService.computeTextDiff(original, modified);

      expect(diff.hasChanges).toBe(true);
      expect(diff.hunks).toHaveLength(1);
      expect(diff.hunks[0].removedLines).toContain('Hello, world!');
      expect(diff.hunks[0].addedLines).toContain('Hello, Claude!');
    });

    it('handles multiline changes', () => {
      const original = 'Line 1\nLine 2\nLine 3';
      const modified = 'Line 1\nModified Line\nLine 3';

      const diff = diffService.computeTextDiff(original, modified);

      expect(diff.hasChanges).toBe(true);
    });
  });

  describe('computeJsonDiff', () => {
    it('returns RFC 6902 patch format', () => {
      const original = { name: 'Alice', age: 30 };
      const modified = { name: 'Alice', age: 31 };

      const patch = diffService.computeJsonDiff(original, modified);

      expect(patch).toEqual([
        { op: 'replace', path: '/age', value: 31 },
      ]);
    });

    it('handles nested object changes', () => {
      const original = { user: { name: 'Alice' } };
      const modified = { user: { name: 'Bob' } };

      const patch = diffService.computeJsonDiff(original, modified);

      expect(patch).toEqual([
        { op: 'replace', path: '/user/name', value: 'Bob' },
      ]);
    });
  });
});
```

### Utility Test

```typescript
// tests/unit/utils/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { hashApiKey, verifyApiKey, signWebhook, verifyWebhookSignature } from '../../../src/utils/crypto';

describe('crypto utilities', () => {
  describe('API Key hashing', () => {
    it('produces consistent hash for same key', async () => {
      const key = 'test-api-key-123';
      const hash1 = await hashApiKey(key);
      const hash2 = await hashApiKey(key);

      expect(hash1).toBe(hash2);
    });

    it('verifies correct key', async () => {
      const key = 'test-api-key-123';
      const hash = await hashApiKey(key);

      expect(await verifyApiKey(key, hash)).toBe(true);
    });

    it('rejects incorrect key', async () => {
      const key = 'test-api-key-123';
      const hash = await hashApiKey(key);

      expect(await verifyApiKey('wrong-key', hash)).toBe(false);
    });
  });

  describe('Webhook signing', () => {
    it('produces valid HMAC signature', () => {
      const payload = JSON.stringify({ event: 'decision', task_id: '123' });
      const secret = 'webhook-secret-456';
      const timestamp = Date.now();

      const signature = signWebhook(payload, secret, timestamp);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('verifies valid signature', () => {
      const payload = JSON.stringify({ event: 'decision' });
      const secret = 'webhook-secret';
      const timestamp = Date.now();
      const signature = signWebhook(payload, secret, timestamp);

      expect(verifyWebhookSignature(payload, secret, signature, timestamp)).toBe(true);
    });

    it('rejects tampered payload', () => {
      const secret = 'webhook-secret';
      const timestamp = Date.now();
      const signature = signWebhook('original', secret, timestamp);

      expect(verifyWebhookSignature('tampered', secret, signature, timestamp)).toBe(false);
    });
  });
});
```

---

## 8. Integration Test Examples

### Route Test

```typescript
// tests/integration/routes/review-tasks.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { build } from '../../../src/app';
import { createTestSource, createTestReviewTask, cleanupTestSource } from '../../helpers/factories';
import { TEST_API_KEYS } from '../../helpers/fixtures';
import type { FastifyInstance } from 'fastify';

describe('Review Tasks API', () => {
  let app: FastifyInstance;
  let testSource: Awaited<ReturnType<typeof createTestSource>>;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    testSource = await createTestSource();
  });

  afterEach(async () => {
    await cleanupTestSource(testSource.id);
  });

  describe('POST /review-tasks', () => {
    it('creates a new review task', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/review-tasks',
        headers: {
          'X-API-Key': TEST_API_KEYS.agent1,
          'Idempotency-Key': `test-${Date.now()}`,
        },
        payload: {
          source_id: testSource.id,
          priority: 'HIGH',
          summary: 'Test task summary',
          artifact_blocks: [
            {
              type: 'markdown',
              content: '# Test content',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.status).toBe('PENDING');
      expect(body.priority).toBe('HIGH');
    });

    it('returns 401 without API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/review-tasks',
        payload: {
          source_id: testSource.id,
          summary: 'Test',
          artifact_blocks: [],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('enforces idempotency', async () => {
      const idempotencyKey = `test-idempotency-${Date.now()}`;
      const payload = {
        source_id: testSource.id,
        summary: 'Idempotency test',
        artifact_blocks: [{ type: 'plaintext', content: 'Test' }],
      };

      const response1 = await app.inject({
        method: 'POST',
        url: '/review-tasks',
        headers: {
          'X-API-Key': TEST_API_KEYS.agent1,
          'Idempotency-Key': idempotencyKey,
        },
        payload,
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/review-tasks',
        headers: {
          'X-API-Key': TEST_API_KEYS.agent1,
          'Idempotency-Key': idempotencyKey,
        },
        payload,
      });

      expect(response1.statusCode).toBe(201);
      expect(response2.statusCode).toBe(200); // Returns existing
      expect(JSON.parse(response1.body).id).toBe(JSON.parse(response2.body).id);
    });
  });

  describe('GET /review-tasks', () => {
    it('returns paginated task list', async () => {
      // Create 5 test tasks
      for (let i = 0; i < 5; i++) {
        await createTestReviewTask({ source_id: testSource.id });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/review-tasks',
        headers: {
          'X-API-Key': TEST_API_KEYS.agent1,
        },
        query: {
          source_id: testSource.id,
          limit: '3',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);
      expect(body.total_count).toBe(5);
      expect(body.next_cursor).toBeDefined();
    });

    it('filters by status', async () => {
      await createTestReviewTask({ source_id: testSource.id, status: 'PENDING' });
      await createTestReviewTask({ source_id: testSource.id, status: 'APPROVED' });

      const response = await app.inject({
        method: 'GET',
        url: '/review-tasks',
        headers: { 'X-API-Key': TEST_API_KEYS.agent1 },
        query: { source_id: testSource.id, status: 'PENDING' },
      });

      const body = JSON.parse(response.body);
      expect(body.data.every((t: any) => t.status === 'PENDING')).toBe(true);
    });
  });

  describe('POST /review-tasks/:id/decision', () => {
    it('approves a task', async () => {
      const task = await createTestReviewTask({ source_id: testSource.id });

      const response = await app.inject({
        method: 'POST',
        url: `/review-tasks/${task.id}/decision`,
        headers: { Cookie: 'session=test-reviewer-session' },
        payload: {
          decision: 'APPROVED',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('APPROVED');
    });

    it('requires reason for denial', async () => {
      const task = await createTestReviewTask({ source_id: testSource.id });

      const response = await app.inject({
        method: 'POST',
        url: `/review-tasks/${task.id}/decision`,
        headers: { Cookie: 'session=test-reviewer-session' },
        payload: {
          decision: 'DENIED',
          // Missing reason
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
```

---

## 9. E2E Test Examples

### Playwright Test

```typescript
// e2e/review-flow.spec.ts
import { test, expect } from '@playwright/test';
import { createTestSource, createTestReviewTask } from '../tests/helpers/factories';
import { FIXTURES } from '../tests/helpers/fixtures';

test.describe('Review Task Flow', () => {
  let testSource: Awaited<ReturnType<typeof createTestSource>>;
  let testTask: Awaited<ReturnType<typeof createTestReviewTask>>;

  test.beforeEach(async () => {
    testSource = await createTestSource();
    testTask = await createTestReviewTask({
      source_id: testSource.id,
      ...FIXTURES.emailSendTask,
    });
  });

  test('reviewer can view and approve a task', async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    await page.click('[data-testid="test-login"]'); // Dev-only bypass

    // Navigate to queue
    await page.goto('/review');
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();

    // Find and click our test task
    await page.click(`[data-testid="task-${testTask.id}"]`);

    // Verify task detail page
    await expect(page.locator('[data-testid="task-summary"]')).toContainText(
      'Send marketing email'
    );

    // Edit content
    await page.click('[data-testid="edit-block-0"]');
    await page.fill('[data-testid="markdown-editor"]', '# Updated Content');
    await page.click('[data-testid="save-changes"]');

    // View diff
    await page.click('[data-testid="toggle-diff"]');
    await expect(page.locator('[data-testid="diff-viewer"]')).toBeVisible();

    // Approve
    await page.click('[data-testid="approve-button"]');
    await page.click('[data-testid="confirm-approval"]');

    // Verify status changed
    await expect(page.locator('[data-testid="task-status"]')).toContainText('APPROVED');
  });

  test('reviewer can deny a task with reason', async ({ page }) => {
    await page.goto(`/review/${testTask.id}`);

    await page.click('[data-testid="deny-button"]');
    await page.fill('[data-testid="deny-reason"]', 'Content needs revision');
    await page.click('[data-testid="confirm-denial"]');

    await expect(page.locator('[data-testid="task-status"]')).toContainText('DENIED');
  });
});
```

---

## 10. Mock Webhook Testing

### Mock Webhook Server

```typescript
// scripts/dev-tools/mock-webhook-server.ts
#!/usr/bin/env tsx

import Fastify from 'fastify';

const app = Fastify({ logger: true });

// Store received webhooks
const webhooks: Array<{
  timestamp: Date;
  headers: Record<string, string>;
  body: unknown;
}> = [];

app.post('/webhook', async (request, reply) => {
  webhooks.push({
    timestamp: new Date(),
    headers: request.headers as Record<string, string>,
    body: request.body,
  });

  console.log('Received webhook:');
  console.log('  Signature:', request.headers['x-hilt-signature']);
  console.log('  Body:', JSON.stringify(request.body, null, 2));

  return { received: true };
});

app.get('/webhooks', async () => {
  return webhooks;
});

app.delete('/webhooks', async () => {
  webhooks.length = 0;
  return { cleared: true };
});

app.listen({ port: 9999 }, (err) => {
  if (err) throw err;
  console.log('Mock webhook server running on http://localhost:9999');
  console.log('POST webhooks to: http://localhost:9999/webhook');
  console.log('View received: GET http://localhost:9999/webhooks');
});
```

### Using webhook.site for External Testing

```bash
# Get a unique webhook URL
curl https://webhook.site/token

# Create source with webhook.site URL
npm run dev:task -- --source test-webhook --webhook https://webhook.site/<your-token>
```

---

## 11. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: hilt_review_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/hilt_review_test
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/hilt_review_test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
```

---

## 12. Summary

| Aspect | Strategy |
|--------|----------|
| **Test Database** | Same DB as production, isolated by `is_test` flag |
| **Test Users** | Pattern: `test+*@hilt-review.test` |
| **Test Sources** | Prefix: `test-*`, auto-flagged |
| **Data Factories** | Faker.js for realistic random data |
| **Static Fixtures** | Realistic scenarios (email, deploy, migration) |
| **CLI Tools** | `npm run dev:task`, `npm run dev:seed` |
| **Cleanup** | `npm run dev:cleanup` removes test data |
| **Webhooks** | Mock server on port 9999, or webhook.site |
| **CI Integration** | GitHub Actions with Postgres service |

### Quick Reference

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Create test task
npm run dev:task -- --type email --priority HIGH

# Seed development data
npm run dev:seed

# Clean up test data
npm run dev:cleanup

# Start mock webhook server
npm run dev:webhook
```
