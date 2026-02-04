#!/usr/bin/env npx tsx
/**
 * Seed script for creating test review tasks
 *
 * Usage:
 *   npx tsx scripts/seed-test-tasks.ts           # Create 10 default tasks
 *   npx tsx scripts/seed-test-tasks.ts --count=5 # Create 5 tasks
 *   npx tsx scripts/seed-test-tasks.ts --clear   # Clear existing tasks first
 */

import { db } from '../src/db/index.js';
import { sources, reviewTasks, apiKeys } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID, createHash } from 'crypto';

// Parse CLI args
const args = process.argv.slice(2);
const count = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] || '10');
const shouldClear = args.includes('--clear');

// Test task scenarios
const scenarios = [
  {
    title: 'Send welcome email to new user',
    service: { id: 'gmail', name: 'Gmail', icon: '📧' },
    action: { type: 'send' as const, verb: 'Send Email', icon: '📤' },
    risk_level: 'low' as const,
    blocks: [
      { id: 'to', label: 'To', type: 'plaintext' as const, content: 'newuser@example.com', editable: false },
      { id: 'subject', label: 'Subject', type: 'plaintext' as const, content: 'Welcome to our platform!', editable: true },
      { id: 'body', label: 'Body', type: 'markdown' as const, content: '# Welcome!\n\nThank you for signing up. We\'re excited to have you on board.\n\n**Getting Started:**\n1. Complete your profile\n2. Explore our features\n3. Join our community\n\nBest regards,\nThe Team', editable: true },
    ],
  },
  {
    title: 'Post weekly update to Slack #general',
    service: { id: 'slack', name: 'Slack', icon: '💬' },
    action: { type: 'post' as const, verb: 'Post Message', icon: '📝' },
    risk_level: 'low' as const,
    blocks: [
      { id: 'channel', label: 'Channel', type: 'plaintext' as const, content: '#general', editable: false },
      { id: 'message', label: 'Message', type: 'markdown' as const, content: '📊 **Weekly Update**\n\n- Shipped 3 new features\n- Fixed 12 bugs\n- Team velocity: 94 points\n\nGreat work everyone! 🎉', editable: true },
    ],
  },
  {
    title: 'Schedule meeting with client',
    service: { id: 'calendar', name: 'Google Calendar', icon: '📅' },
    action: { type: 'schedule' as const, verb: 'Create Event', icon: '⏰' },
    risk_level: 'low' as const,
    blocks: [
      { id: 'event', label: 'Event Details', type: 'json' as const, content: { title: 'Q1 Planning Review', date: '2026-02-10', time: '14:00', duration: '1 hour', attendees: ['client@acme.com', 'pm@company.com'] }, editable: true },
    ],
  },
  {
    title: 'Send invoice to Acme Corp',
    service: { id: 'billing', name: 'Stripe', icon: '💳' },
    action: { type: 'send' as const, verb: 'Send Invoice', icon: '📄' },
    risk_level: 'medium' as const,
    risk_warning: 'This will send a payment request to the customer.',
    blocks: [
      { id: 'invoice', label: 'Invoice Details', type: 'json' as const, content: { customer: 'Acme Corp', amount: 4500.00, currency: 'USD', items: [{ description: 'Consulting Services - January', hours: 30, rate: 150 }], due_date: '2026-02-28' }, editable: true },
      { id: 'notes', label: 'Notes', type: 'plaintext' as const, content: 'Thank you for your business!', editable: true },
    ],
  },
  {
    title: 'Update customer subscription plan',
    service: { id: 'billing', name: 'Stripe', icon: '💳' },
    action: { type: 'update' as const, verb: 'Change Plan', icon: '🔄' },
    risk_level: 'medium' as const,
    blocks: [
      { id: 'change', label: 'Plan Change', type: 'json' as const, content: { customer_id: 'cus_ABC123', current_plan: 'starter', new_plan: 'professional', price_change: '+$50/month', effective_date: '2026-03-01' }, editable: false },
      { id: 'reason', label: 'Reason', type: 'plaintext' as const, content: 'Customer requested upgrade after trial', editable: true },
    ],
  },
  {
    title: 'Reply to support ticket #4521',
    service: { id: 'zendesk', name: 'Zendesk', icon: '🎫' },
    action: { type: 'reply' as const, verb: 'Send Reply', icon: '↩️' },
    risk_level: 'medium' as const,
    blocks: [
      { id: 'ticket', label: 'Ticket Info', type: 'json' as const, content: { id: 4521, subject: 'Cannot access dashboard', customer: 'frustrated.user@example.com', priority: 'high' }, editable: false },
      { id: 'response', label: 'Response', type: 'markdown' as const, content: 'Hi,\n\nThank you for reaching out. I understand how frustrating this must be.\n\nI\'ve looked into your account and found the issue - your session expired due to a recent security update. Please try:\n\n1. Clear your browser cache\n2. Log out and log back in\n3. If the issue persists, try an incognito window\n\nLet me know if this helps!\n\nBest,\nSupport Team', editable: true },
    ],
  },
  {
    title: 'Archive inactive users (150 accounts)',
    service: { id: 'database', name: 'User Service', icon: '🗄️' },
    action: { type: 'archive' as const, verb: 'Archive Users', icon: '📦' },
    risk_level: 'high' as const,
    risk_warning: 'This will archive 150 user accounts that have been inactive for 12+ months.',
    priority: 'HIGH' as const,
    blocks: [
      { id: 'criteria', label: 'Archive Criteria', type: 'json' as const, content: { inactive_days: 365, account_count: 150, data_retention: '7 years', reversible: true }, editable: false },
      { id: 'sample', label: 'Sample Accounts', type: 'json' as const, content: [{ email: 'old.user1@example.com', last_login: '2025-01-15' }, { email: 'old.user2@example.com', last_login: '2025-02-01' }], editable: false },
    ],
  },
  {
    title: 'Delete customer data (GDPR request)',
    service: { id: 'database', name: 'User Service', icon: '🗄️' },
    action: { type: 'delete' as const, verb: 'Delete Data', icon: '🗑️' },
    risk_level: 'high' as const,
    risk_warning: 'This action is IRREVERSIBLE. All user data will be permanently deleted per GDPR Article 17.',
    priority: 'HIGH' as const,
    interaction_schema: {
      type: 'edit' as const,
      deny_reasons: [
        { id: 'verify-identity', label: 'Need to verify requester identity' },
        { id: 'active-subscription', label: 'User has active paid subscription' },
        { id: 'legal-hold', label: 'Account under legal hold' },
      ],
      require_confirmation: true,
    },
    blocks: [
      { id: 'user', label: 'User to Delete', type: 'json' as const, content: { id: 'usr_12345', email: 'john.doe@example.com', name: 'John Doe', account_created: '2023-06-15', request_date: '2026-02-01' }, editable: false },
      { id: 'data-scope', label: 'Data to Delete', type: 'json' as const, content: { profile: true, orders: true, messages: true, analytics: true, backups: 'after 30 days' }, editable: false },
    ],
  },
  {
    title: 'Transfer $25,000 to vendor account',
    service: { id: 'banking', name: 'Bank API', icon: '🏦' },
    action: { type: 'transfer' as const, verb: 'Wire Transfer', icon: '💸' },
    risk_level: 'critical' as const,
    risk_warning: 'Large financial transaction. Verify recipient details carefully.',
    priority: 'HIGH' as const,
    execution_intent: {
      kind: 'http_request' as const,
      template_id: 'bank-wire-transfer',
      display: {
        action_type: 'POST /v1/transfers',
        target: 'api.bank.com',
        warning: 'Funds cannot be recalled after 24 hours',
      },
    },
    interaction_schema: {
      type: 'confirm' as const,
      require_confirmation: true,
      deny_reasons: [
        { id: 'wrong-amount', label: 'Incorrect amount' },
        { id: 'wrong-recipient', label: 'Wrong recipient details' },
        { id: 'duplicate', label: 'Duplicate payment' },
        { id: 'not-approved', label: 'Not yet approved internally' },
      ],
    },
    blocks: [
      { id: 'transfer', label: 'Transfer Details', type: 'json' as const, content: { amount: 25000.00, currency: 'USD', recipient: { name: 'Tech Supplies Inc', account: '****4567', bank: 'Chase', routing: '****1234' }, reference: 'PO-2026-0142', memo: 'Server hardware Q1' }, editable: false },
      { id: 'approval', label: 'Internal Approval', type: 'json' as const, content: { requested_by: 'ops@company.com', approved_by: 'cfo@company.com', po_number: 'PO-2026-0142' }, editable: false },
    ],
  },
  {
    title: 'Deploy v2.5.0 to production',
    service: { id: 'deploy', name: 'GitHub Actions', icon: '🚀' },
    action: { type: 'create' as const, verb: 'Deploy', icon: '⚡' },
    risk_level: 'critical' as const,
    risk_warning: 'Production deployment will affect all users. Ensure QA sign-off is complete.',
    priority: 'HIGH' as const,
    execution_intent: {
      kind: 'command_template' as const,
      template_id: 'prod-deploy',
      display: {
        action_type: 'Deploy to Production',
        target: 'prod-cluster-east',
        warning: 'Rolling deployment, ~5 min downtime possible',
        icon: '🚀',
      },
    },
    blocks: [
      { id: 'release', label: 'Release Info', type: 'json' as const, content: { version: '2.5.0', branch: 'main', commit: 'abc1234', changelog: ['feat: new dashboard', 'fix: login timeout', 'perf: 40% faster queries'] }, editable: false },
      { id: 'checklist', label: 'Pre-deploy Checklist', type: 'markdown' as const, content: '- [x] All tests passing\n- [x] QA sign-off\n- [x] Database migrations reviewed\n- [x] Rollback plan documented\n- [ ] On-call engineer notified', editable: true },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding test tasks...\n');

  // 1. Find or create test source
  let [source] = await db.select().from(sources).where(eq(sources.name, 'Test Agent (Seeder)'));

  if (!source) {
    console.log('Creating test source...');
    [source] = await db.insert(sources).values({
      name: 'Test Agent (Seeder)',
      description: 'Auto-generated source for seeding test tasks',
      deliveryMode: 'PULL_ONLY',
      webhookEnabled: false,
    }).returning();
    console.log(`  ✓ Created source: ${source.id}\n`);
  } else {
    console.log(`Using existing source: ${source.id}\n`);
  }

  // 2. Clear existing tasks if requested
  if (shouldClear) {
    console.log('Clearing existing tasks from this source...');
    const deleted = await db.delete(reviewTasks).where(eq(reviewTasks.sourceId, source.id));
    console.log('  ✓ Cleared existing tasks\n');
  }

  // 3. Create test tasks
  console.log(`Creating ${count} test tasks...\n`);
  const created: { id: string; title: string; risk_level: string }[] = [];

  for (let i = 0; i < count; i++) {
    const scenario = scenarios[i % scenarios.length];

    // Generate preview from first block
    const firstBlock = scenario.blocks[0];
    const preview = typeof firstBlock.content === 'string'
      ? firstBlock.content.substring(0, 200)
      : JSON.stringify(firstBlock.content).substring(0, 200);

    const [task] = await db.insert(reviewTasks).values({
      sourceId: source.id,
      title: scenario.title,
      preview,
      priority: scenario.priority || 'NORMAL',
      service: scenario.service,
      action: scenario.action,
      riskLevel: scenario.risk_level,
      riskWarning: scenario.risk_warning,
      interactionSchema: scenario.interaction_schema,
      executionIntent: scenario.execution_intent,
      blocksOriginal: scenario.blocks,
      blocksWorking: scenario.blocks,
    }).returning();

    created.push({ id: task.id, title: task.title, risk_level: task.riskLevel });

    const riskEmoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[task.riskLevel];
    console.log(`  ${riskEmoji} [${task.riskLevel.padEnd(8)}] ${task.title}`);
    console.log(`     ID: ${task.id}`);
  }

  console.log(`\n✅ Created ${created.length} test tasks!`);
  console.log(`\n📋 View them at: http://localhost:5173\n`);

  // Summary by risk level
  const byRisk = created.reduce((acc, t) => {
    acc[t.risk_level] = (acc[t.risk_level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Summary by risk level:');
  Object.entries(byRisk).forEach(([risk, count]) => {
    const emoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[risk];
    console.log(`  ${emoji} ${risk}: ${count}`);
  });

  process.exit(0);
}

main().catch((err) => {
  console.error('Error seeding tasks:', err);
  process.exit(1);
});
