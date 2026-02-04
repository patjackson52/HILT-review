import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  // OAuth config - optional until OAuth is implemented (Tasks 17-18)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_REDIRECT_URI: z.string().url().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  ALLOWED_DOMAINS: z.string().transform(s => {
    try { return JSON.parse(s); } catch { return undefined; }
  }).pipe(z.array(z.string()).optional()).optional(),
  CORS_ORIGIN: z.string().url().optional(),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
