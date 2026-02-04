# Dashboard & Task Detail UI Redesign

**Date:** 2026-02-04
**Status:** Design Complete - Pending Implementation

---

## Overview

This document describes UI/UX refinements to the Review Queue (dashboard) and Task Detail pages to better support personal AI agent ecosystems where agents connect to multiple services (email, chat, social media, notes, finance) and propose actions across them.

### Problem Statement

The original spec treated all tasks as generic text entries. Users couldn't quickly identify:
- **What service** the task relates to (Gmail, Slack, Twitter, etc.)
- **What action** will happen (send, post, delete, transfer, etc.)
- **What risk level** the action carries (private note vs public post vs financial transaction)

### Solution

A visual language system using:
1. **Service icons** - Instantly recognize the platform
2. **Action icons** - Understand what will happen
3. **Risk bands** - Color-coded consequence levels
4. **Risk-scaled friction** - More confirmation for higher stakes

---

## Part 1: Taxonomy

### Source Services

| Category | Examples |
|----------|----------|
| **Communication** | Gmail, Outlook, Slack, Discord, Teams, Twitter/X, LinkedIn |
| **Knowledge/Second Brain** | Notion, Obsidian, Roam, Apple Notes, Google Docs |
| **Productivity** | Google Calendar, Todoist, Linear |
| **Finance** | Banks, Venmo, PayPal |
| **External/Web** | Websites via MCP, APIs, RSS feeds, webhooks |

### Action Types

| Action | Icon | Verbs |
|--------|------|-------|
| Send/Reply | 📤 | Send, Reply, Forward |
| Post/Publish | 📢 | Post, Publish, Share |
| Create | 📝 | Create, Draft, Add |
| Update/Edit | ✏️ | Update, Edit, Modify |
| Delete | 🗑️ | Delete, Remove |
| Archive | 📥 | Archive, Snooze |
| Schedule | 📅 | Schedule, Book, RSVP |
| Purchase/Pay | 💰 | Pay, Purchase, Transfer |
| Notify | 💡 | Insight, Alert, Suggestion |

### Risk Levels

| Level | Color | Band | Examples |
|-------|-------|------|----------|
| Low | Green | `#16A34A` | Create draft, private notes, archive |
| Medium | Amber | `#D97706` | Reply to known contact, internal chat |
| High | Red | `#DC2626` | Public post, external email, delete |
| Critical | Purple/Black | `#7C3AED` | Financial transaction, legal, irreversible |

**Risk is determined by:**
1. Audience (private → known → public → strangers)
2. Reversibility (draft → editable → hard to undo → permanent)
3. Consequence type (informational → social → financial → legal)

---

## Part 2: Dashboard / Review Queue

### Layout Change

**From:** Table with columns (Priority, Source, Summary, Status, Created)

**To:** Card-based layout with visual signifiers

### Card Anatomy

```
┌─ RISK BAND (4px solid color) ────────────────────────────────────┐
│                                                                   │
│  [Service Icon] Service Name · [Action Icon] Action Type    Time  │
│                                                                   │
│  Task Title / Summary (bold, 1 line max)                          │
│  Preview text - first ~100 chars of content... (muted color)      │
│                                                                   │
│  [Optional: warning badge for critical actions]                   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Card Examples

**Low Risk:**
```
┌─🟢─────────────────────────────────────────────────────────────────┐
│  📓 Notion · 📝 Create note                              2 hrs ago │
│  Meeting notes from standup                                        │
│  "Discussed Q1 priorities. Action items: Patrick to review..."    │
└────────────────────────────────────────────────────────────────────┘
```

**Medium Risk:**
```
┌─🟡─────────────────────────────────────────────────────────────────┐
│  ✉️ Gmail · 📤 Reply                                      5 min ago │
│  Re: Invoice #38122                                                │
│  "Thanks for sending this over. I've reviewed the line items..."  │
└────────────────────────────────────────────────────────────────────┘
```

**High Risk:**
```
┌─🔴─────────────────────────────────────────────────────────────────┐
│  🐦 Twitter · 📢 Post publicly                           12 min ago │
│  Thread about your side project                                    │
│  "I've been working on something for the past few months and..."  │
└────────────────────────────────────────────────────────────────────┘
```

**Critical Risk:**
```
┌─⚫─────────────────────────────────────────────────────────────────┐
│  🏦 Chase · 💰 Transfer $450.00                           2 hrs ago │
│  Pay invoice to Acme Consulting                                    │
│  Account ending ****4821 → External account                        │
│  ⚠️ Irreversible financial transaction                             │
└────────────────────────────────────────────────────────────────────┘
```

**Cross-Service Flow:**
```
┌─🟡─────────────────────────────────────────────────────────────────┐
│  📓 Notion → ✉️ Gmail · 📤 Send email                     3 hrs ago │
│  Follow-up with Sam about proposal                                 │
│  "Based on your notes from last week's call, drafting a check-in..│
└────────────────────────────────────────────────────────────────────┘
```

### Full Queue View

```
┌─────────────────────────────────────────────────────────────────────┐
│  Review Queue                                            [Refresh]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Filters                                                            │
│  Risk: [All ▼]   Service: [All ▼]   Action: [All ▼]   Status: [Pending ▼]  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─⚫───────────────────────────────────────────────────────────┐   │
│  │  🏦 Chase · 💰 Transfer $450.00                    2 min ago │   │
│  │  Pay invoice to Acme Consulting                              │   │
│  │  Account ****4821 → External account                         │   │
│  │  ⚠️ Irreversible financial transaction                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─🔴───────────────────────────────────────────────────────────┐   │
│  │  🐦 Twitter · 📢 Post publicly                     12 min ago │   │
│  │  Thread about your side project                              │   │
│  │  "I've been working on something for the past few months..." │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ... more cards ...                                                 │
│                                                                     │
│  Showing 5 of 12 tasks                            [Load more...]    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Queue Behavior

| Aspect | Decision |
|--------|----------|
| Default sort | Newest first |
| Filters | Risk, Service, Action, Status |
| Click behavior | Navigate to task detail |
| Hover | Subtle elevation + background shift |
| Quick actions | User preference (default off) |

### Mobile View

Cards stack full-width, filters collapse to dropdowns/bottom sheet, preview text truncated.

```
┌─────────────────────────────┐
│ Review Queue      [⚙] [↻]  │
├─────────────────────────────┤
│ [Risk ▼] [Service ▼] [More] │
├─────────────────────────────┤
│ ┌─⚫─────────────────────┐  │
│ │ 🏦 Chase · 💰 Transfer │  │
│ │ $450.00       2 min ago│  │
│ │ Pay invoice to Acme    │  │
│ │ ⚠️ Irreversible        │  │
│ └────────────────────────┘  │
│                             │
│ ┌─🔴─────────────────────┐  │
│ │ 🐦 Twitter · 📢 Post   │  │
│ │ publicly     12 min ago│  │
│ │ Thread about your side │  │
│ │ project                │  │
│ └────────────────────────┘  │
│                             │
│      [Load more...]         │
└─────────────────────────────┘
```

---

## Part 3: Task Detail Page

### Header

Consistent with card design, expanded with metadata:

```
┌─🟡────────────────────────────────────────────────────────────────┐
│                                                                    │
│  ✉️ Gmail · 📤 Reply                                    PENDING   │
│                                                                    │
│  Re: Invoice #38122                                                │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Created: Jan 15, 2024 at 2:30 PM (5 min ago)                 │ │
│  │ Task ID: 550e8400-e29b-41d4...  [Copy]                       │ │
│  │ Source config: email-agent                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Critical risk header includes warning:**
```
│  ⚠️ CRITICAL: Irreversible financial transaction                  │
```

### Execution Intent Panel

Always visible, visual, risk-appropriate warnings:

**Standard:**
```
┌─────────────────────────────────────────────────────────────────┐
│  📤 WHAT HAPPENS IF APPROVED                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────┐                                                      │
│  │  ✉️   │  Send email via Gmail                                │
│  └───────┘                                                      │
│            To: sam@vendor.com (external)                        │
│            Subject: Re: Invoice #38122                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Cross-service:**
```
┌─────────────────────────────────────────────────────────────────┐
│  📤 WHAT HAPPENS IF APPROVED                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────┐         ┌───────┐                                    │
│  │  📓   │  ────►  │  ✉️   │  Send email via Gmail              │
│  └───────┘         └───────┘                                    │
│   Notion            Gmail                                       │
│   (source)          (action)                                    │
│                                                                 │
│            To: sam@partner.com                                  │
│            Based on: "Q4 Partner Follow-ups" note               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Critical:**
```
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ⚠️ IRREVERSIBLE                                             │ │
│  │ This transaction cannot be undone once submitted.           │ │
│  └────────────────────────────────────────────────────────────┘ │
```

### Block Editors

Agent provides human-readable labels:

```
┌─────────────────────────────────────────────────────────────────┐
│  📧 Email Subject                                    [plaintext] │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Re: Invoice #38122                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ✏️ Modified from original                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Decision Controls

Risk-scaled friction:

**Low risk:**
```
│       [Deny]                              [Approve ✓]           │
│  📝 Create note in Notion (private)                             │
```

**Medium risk:**
```
│       [Deny]                              [Approve & Send]      │
│  📤 Send email to sam@vendor.com (external contact)             │
```

**High risk:**
```
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ⚠️ This will post publicly to 2,847 followers               │ │
│  └────────────────────────────────────────────────────────────┘ │
│       [Deny]                           [Approve & Post]         │
```

**Critical risk:**
```
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ⚠️ IRREVERSIBLE TRANSACTION                                 │ │
│  │                                                             │ │
│  │ You are about to transfer $450.00 from Chase ****4821       │ │
│  │ to an external account. This cannot be undone.              │ │
│  │                                                             │ │
│  │ ☐ I have verified the recipient and amount                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│       [Deny]                           [Approve & Transfer]     │
│                                        (disabled until checked) │
```

### Post-Decision State

Risk band reflects outcome:

**Approved (green band):**
```
┌─🟢────────────────────────────────────────────────────────────────┐
│  ✉️ Gmail · 📤 Reply                                   APPROVED   │
│  Re: Invoice #38122                                                │
└────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ✓ APPROVED & EXECUTED                                          │
│  Decision by: jane@acme.com                                     │
│  Decision at: January 15, 2024 at 2:35 PM                       │
│  Status: ✓ Dispatched to executor                               │
└─────────────────────────────────────────────────────────────────┘
```

**Denied (red band):**
```
┌─🔴────────────────────────────────────────────────────────────────┐
│  🐦 Twitter · 📢 Post publicly                          DENIED    │
│  Thread about your side project                                    │
└────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ✕ DENIED                                                       │
│  Decision by: jane@acme.com                                     │
│  Reason: "Too self-promotional. Rewrite with more value."       │
│  Status: ✕ Not executed                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Data Model Changes

### New/Modified Fields

**ReviewTask:**
```typescript
interface ReviewTask {
  // ... existing fields ...

  // NEW: Visual identification
  service: {
    id: string;           // "gmail", "twitter", "notion"
    name: string;         // "Gmail", "Twitter", "Notion"
    icon?: string;        // URL or icon key
  };

  // NEW: For cross-service flows
  source_service?: {
    id: string;
    name: string;
    icon?: string;
  };

  // NEW: Action identification
  action: {
    type: string;         // "send", "post", "create", "transfer"
    verb: string;         // "Reply", "Post publicly", "Create note"
    icon?: string;        // "📤", "📢", "📝", "💰"
  };

  // NEW: Risk level
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_warning?: string;  // "Irreversible financial transaction"
}
```

**ArtifactBlock:**
```typescript
interface ArtifactBlock {
  id: string;             // machine key: "email_subject"
  label: string;          // NEW: human label: "Email Subject"
  type: 'markdown' | 'plaintext' | 'json';
  content: string | Record<string, unknown>;
  editable: boolean;
  render_hints?: {
    preview?: boolean;
    syntax_highlighting?: boolean;
  };
}
```

**ReviewTaskListItem (for queue):**
```typescript
interface ReviewTaskListItem {
  id: string;
  status: ReviewTaskStatus;

  // Visual identification
  service: { id: string; name: string; icon?: string; };
  source_service?: { id: string; name: string; icon?: string; };
  action: { type: string; verb: string; icon?: string; };
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_warning?: string;

  // Content
  title: string;          // Was "summary"
  preview: string;        // First ~100 chars of main content

  // Timestamps
  created_at: string;
  updated_at: string;
}
```

---

## Part 5: Implementation Notes

### Iconography

Use brand logos where available, category fallbacks otherwise:
- Gmail, Slack, Twitter, Notion, etc. → brand icons
- Generic email, chat, notes → category icons (✉️📓💬)
- Custom MCP integrations → default gear icon (⚙️)

Custom icon upload deferred to future enhancement.

### Risk Determination

Agent provides `risk_level` when creating task. System may override based on:
- Action type (transfer/purchase → minimum "high")
- Audience (public → minimum "high")
- Amount (financial > threshold → "critical")

### Quick Actions

User preference to enable/disable quick approve/deny on cards. Default: off.

---

## Next Steps

1. Review OpenAPI spec for data model parity
2. Update schema definitions
3. Implementation planning
