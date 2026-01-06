import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'), // Railway sets PORT automatically
  API_PORT: z.string().optional(), // Legacy support
  API_URL: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().default('https://aiugcify.com'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Stripe
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  STRIPE_PRICE_STARTER: z.string(),
  STRIPE_PRICE_CREATOR: z.string(),
  STRIPE_PRICE_PRO: z.string(),
  STRIPE_PRICE_AGENCY: z.string(),

  // OpenAI (ChatGPT for script generation)
  OPENAI_API_KEY: z.string(),

  // Kie.ai (Sora 2 Video generation)
  KIE_API_KEY: z.string(),
  KIE_API_BASE_URL: z.string().default('https://api.kie.ai'),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  // Freemium
  FREE_CREDITS_ON_SIGNUP: z.string().default('2'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.format());
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

export const config = loadConfig();

export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
