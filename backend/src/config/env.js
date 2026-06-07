import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate all environment variables at startup.
 * If anything is missing or wrong, the app crashes immediately
 * with a clear error — not silently in production.
 */
const envSchema = z.object({
  // Server
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Korapay
  KORAPAY_SECRET_KEY: z.string().min(1),
  KORAPAY_PUBLIC_KEY: z.string().min(1),
  KORAPAY_WEBHOOK_SECRET: z.string().min(1),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_AUTH: z.string().default('10'),
  RATE_LIMIT_MAX_GENERAL: z.string().default('100'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  parsed.error.issues.forEach((issue) => {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = {
  port: parseInt(parsed.data.PORT, 10),
  nodeEnv: parsed.data.NODE_ENV,
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
  appUrl: parsed.data.APP_URL,
  frontendUrl: parsed.data.FRONTEND_URL,

  supabase: {
    url: parsed.data.SUPABASE_URL,
    anonKey: parsed.data.SUPABASE_ANON_KEY,
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  },

  jwt: {
    accessSecret: parsed.data.JWT_ACCESS_SECRET,
    refreshSecret: parsed.data.JWT_REFRESH_SECRET,
    accessExpiresIn: parsed.data.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
  },

  korapay: {
    secretKey: parsed.data.KORAPAY_SECRET_KEY,
    publicKey: parsed.data.KORAPAY_PUBLIC_KEY,
    webhookSecret: parsed.data.KORAPAY_WEBHOOK_SECRET,
  },

  rateLimit: {
    windowMs: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
    maxAuth: parseInt(parsed.data.RATE_LIMIT_MAX_AUTH, 10),
    maxGeneral: parseInt(parsed.data.RATE_LIMIT_MAX_GENERAL, 10),
  },
};
