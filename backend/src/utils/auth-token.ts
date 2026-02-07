import crypto from 'crypto';
import { config } from '../config/index.js';

interface TokenPayload {
  userId: string;
  email: string;
  name: string | null;
  picture: string | null;
  exp: number;
}

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): string {
  return config.SESSION_SECRET || 'dev-secret-must-be-at-least-32-chars-long';
}

export function createAuthToken(user: {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
}): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    picture: user.pictureUrl,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };

  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('base64url');

  return `${data}.${sig}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, sig] = parts;

  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('base64url');

  // Timing-safe comparison to prevent timing attacks
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload: TokenPayload = JSON.parse(
      Buffer.from(data, 'base64url').toString()
    );

    if (payload.exp && Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}
