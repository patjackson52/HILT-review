# HILT-Review — Authentication & Authorization

This document specifies authentication mechanisms for HILT-Review's two distinct user types:

1. **Human Reviewers** — Authenticate via Google OAuth 2.0
2. **Machine Clients** (Agents & Executors) — Authenticate via API Keys

---

## 1. Human Reviewer Authentication

### 1.1 OAuth 2.0 with Google

Human reviewers authenticate using **Google OAuth 2.0** with OpenID Connect (OIDC).

**Flow**: Authorization Code Flow with PKCE (recommended for web apps)

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│ Reviewer │ ──▶ │ HILT-Review  │ ──▶ │ Google OAuth    │
│ Browser  │ ◀── │ Frontend     │ ◀── │ (accounts.google│
└──────────┘     └──────────────┘     └─────────────────┘
```

### 1.2 Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | `GOCSPX-...` |
| `OAUTH_REDIRECT_URI` | Callback URL after Google auth | `https://api.hilt-review.example.com/api/v1/auth/google/callback` |
| `ALLOWED_DOMAINS` | Optional: restrict to specific Google Workspace domains | `["acme.com", "acme.io"]` |
| `ALLOWED_EMAILS` | Optional: explicit allowlist of email addresses | `["admin@acme.com"]` |

### 1.3 Domain Restriction (Recommended for Enterprise)

For internal deployments, restrict authentication to specific Google Workspace domains:

```json
{
  "allowed_domains": ["yourcompany.com"],
  "allowed_emails": []
}
```

If both `allowed_domains` and `allowed_emails` are empty, any Google account can authenticate (not recommended for production).

### 1.4 Session Management

| Parameter | Value | Notes |
|-----------|-------|-------|
| Session Duration | 8 hours | Configurable via `SESSION_TTL_HOURS` |
| Session Storage | Server-side (Redis or PostgreSQL) | Stateless JWT alternative available |
| Cookie Name | `hilt_session` | HttpOnly, Secure, SameSite=Lax |
| Refresh | Sliding window | Session extends on activity |

### 1.5 Logout

- `POST /auth/logout` — Invalidates server-side session
- Frontend clears `hilt_session` cookie
- Google account remains signed in (HILT-Review does not force Google sign-out)

### 1.6 User Model (MVP)

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    name            TEXT,
    picture_url     TEXT,
    google_sub      TEXT NOT NULL UNIQUE,  -- Google's unique user ID
    created_at      TIMESTAMPTZ DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);
```

For MVP, all authenticated users have equal reviewer permissions (no role-based access control).

---

## 2. Machine Client Authentication (API Keys)

### 2.1 Overview

Upstream agents and downstream executors authenticate using **API keys** passed in the `X-API-Key` header.

```http
POST /review-tasks HTTP/1.1
Host: api.hilt-review.example.com
X-API-Key: hilt_sk_live_abc123...
Content-Type: application/json
```

### 2.2 API Key Types

| Type | Prefix | Permissions | Use Case |
|------|--------|-------------|----------|
| **Source Key** | `hilt_sk_` | Scoped to one source | Agent submitting tasks for a specific integration |
| **Admin Key** | `hilt_ak_` | Full API access | Administrative operations, source management |

### 2.3 API Key Format

```
hilt_sk_live_<32_char_random_hex>
hilt_sk_test_<32_char_random_hex>
```

- **Prefix**: `hilt_sk_` (source key) or `hilt_ak_` (admin key)
- **Environment**: `live_` or `test_`
- **Secret**: 32 character hex string (128 bits of entropy)

Example: `hilt_sk_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`

### 2.4 API Key Storage

```sql
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID REFERENCES sources(id),  -- NULL for admin keys
    key_prefix      TEXT NOT NULL,                -- First 12 chars for identification
    key_hash        TEXT NOT NULL,                -- bcrypt or argon2 hash of full key
    key_type        TEXT NOT NULL CHECK (key_type IN ('source', 'admin')),
    environment     TEXT NOT NULL CHECK (environment IN ('live', 'test')),
    name            TEXT,                         -- Human-readable label
    created_at      TIMESTAMPTZ DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    last_used_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,

    UNIQUE (key_prefix)
);
```

**Security Notes:**
- Full API key is shown **once** at creation time, then only the prefix is stored
- Keys are hashed using bcrypt (cost factor 12) or argon2id
- Revoked keys remain in table for audit trail

### 2.5 Key Rotation

1. Create new API key for the source
2. Update agent/executor configuration to use new key
3. Verify new key works
4. Revoke old key via `DELETE /api-keys/{key_id}`

### 2.6 API Key Endpoints

```yaml
POST /api-keys
  # Create a new API key
  # Request: { "source_id": "uuid", "name": "production-agent", "type": "source" }
  # Response: { "id": "uuid", "key": "hilt_sk_live_...", "prefix": "hilt_sk_live_a1b2" }
  # NOTE: Full key is only returned once!

GET /api-keys
  # List API keys (returns prefix only, not full key)

DELETE /api-keys/{key_id}
  # Revoke an API key
```

---

## 3. Webhook Signature Verification

Downstream executors must verify webhook authenticity using HMAC signatures.

### 3.1 Signature Header Format

```
X-HILT-Signature: t=1699900000,v1=5d41402abc4b2a76b9719d911017c592
```

- `t` — Unix timestamp when signature was generated
- `v1` — HMAC-SHA256 signature (hex-encoded)

### 3.2 Signature Generation (HILT-Review side)

```python
import hmac
import hashlib
import time

def sign_webhook(payload_bytes: bytes, secret: str) -> str:
    timestamp = int(time.time())
    signed_payload = f"{timestamp}.{payload_bytes.decode('utf-8')}"
    signature = hmac.new(
        secret.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={signature}"
```

### 3.3 Signature Verification (Executor side)

```python
def verify_webhook(payload: bytes, signature_header: str, secret: str, tolerance_seconds: int = 300) -> bool:
    # Parse header
    parts = dict(p.split('=') for p in signature_header.split(','))
    timestamp = int(parts['t'])
    received_sig = parts['v1']

    # Check timestamp (prevent replay attacks)
    if abs(time.time() - timestamp) > tolerance_seconds:
        return False

    # Compute expected signature
    signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
    expected_sig = hmac.new(
        secret.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    # Constant-time comparison
    return hmac.compare_digest(received_sig, expected_sig)
```

### 3.4 Webhook Secret Management

- Each source has its own `webhook_secret`
- Secrets are 32+ bytes of cryptographically random data
- Stored encrypted at rest in the database
- Rotatable via source configuration update

---

## 4. Authorization Model (MVP)

### 4.1 Permissions Matrix

| Actor | Create Task | Read Task | Edit Task | Decide | Manage Sources |
|-------|-------------|-----------|-----------|--------|----------------|
| **Source API Key** | ✅ (own source) | ✅ (own source) | ❌ | ❌ | ❌ |
| **Admin API Key** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Authenticated Reviewer** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Unauthenticated** | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.2 Future: Role-Based Access Control

Post-MVP, consider adding:
- Reviewer roles (viewer, editor, approver)
- Source-scoped reviewer permissions
- Approval policies (e.g., require 2 approvers for high-priority tasks)

---

## 5. Security Best Practices

### 5.1 For Reviewers
- Use strong Google account passwords with 2FA enabled
- Log out from shared devices
- Report suspicious review tasks

### 5.2 For Agents/Executors
- Store API keys in secrets management (Vault, AWS Secrets Manager, etc.)
- Never commit API keys to source control
- Use `test_` keys for development, `live_` keys for production
- Rotate keys periodically (every 90 days recommended)

### 5.3 For Operators
- Enable Google Workspace domain restriction
- Monitor `api_keys.last_used_at` for unused keys
- Set up alerts for authentication failures
- Use HTTPS only (redirect HTTP → HTTPS)

---

## 6. Environment Variables

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
OAUTH_REDIRECT_URI=https://api.hilt-review.example.com/api/v1/auth/google/callback

# Domain restriction (JSON array or comma-separated)
ALLOWED_DOMAINS=["yourcompany.com"]

# Session
SESSION_SECRET=<64-byte-random-hex>
SESSION_TTL_HOURS=8

# API Key encryption
API_KEY_ENCRYPTION_KEY=<32-byte-random-hex>
```

---

## 7. Auth Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/auth/google` | GET | None | Redirect to Google OAuth |
| `/api/v1/auth/google/callback` | GET | None | OAuth callback handler |
| `/api/v1/auth/logout` | POST | Session | Invalidate session |
| `/api/v1/auth/me` | GET | Session | Get current user info |
| `/api/v1/auth/status` | GET | None | Check if OAuth is configured |
| `/api-keys` | GET/POST | Admin | List/create API keys |
| `/api-keys/{id}` | DELETE | Admin | Revoke API key |
