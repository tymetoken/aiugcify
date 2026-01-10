import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisConnection } from '../config/redis.js';
import { config, isDevelopment } from '../config/index.js';
import { ErrorCodes } from '../utils/errors.js';

// Skip Redis store in development to avoid Upstash limits during local dev
const USE_REDIS_RATE_LIMIT = !isDevelopment;

const createStore = () => {
  if (!USE_REDIS_RATE_LIMIT) {
    console.log('Using in-memory rate limiting (development mode)');
    return undefined;
  }

  try {
    return new RedisStore({
      // @ts-expect-error - RedisStore sendCommand type mismatch with ioredis
      sendCommand: async (...args: string[]) => {
        return await redisConnection.call(args[0], ...args.slice(1));
      },
    });
  } catch (error) {
    console.error('Failed to create Redis store, falling back to in-memory:', error);
    return undefined;
  }
};

// General API rate limit
// SECURITY: Never completely disable rate limiting, even in development
export const apiRateLimit = rateLimit({
  windowMs: parseInt(config.RATE_LIMIT_WINDOW_MS, 10),
  max: isDevelopment ? 10000 : 1000, // 1000 requests per 15 min in production
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  // SECURITY: Removed skip parameter - rate limiting always active
  message: {
    success: false,
    error: {
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests, please try again later',
    },
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP with fallback to forwarded header
    const user = (req as { user?: { id: string } }).user;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous';
    return user?.id || (Array.isArray(ip) ? ip[0] : ip);
  },
});

// Stricter limit for auth endpoints (prevent brute force)
// SECURITY: Always enforced to prevent credential stuffing attacks
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 200, // 200 failed attempts per 15 min in prod
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  // SECURITY: Removed skip parameter - rate limiting always active
  skipSuccessfulRequests: true, // Only count failed login attempts
  message: {
    success: false,
    error: {
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Too many login attempts, please try again in 15 minutes',
    },
  },
});

// Stricter limit for video generation
// SECURITY: Always enforced to prevent API abuse and cost overruns
export const videoGenerationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 100 : 30, // Higher limit in dev, but still enforced
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    const user = (req as { user?: { id: string } }).user;
    return user?.id || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Video generation rate limit exceeded, please try again later',
    },
  },
});

// Limit for script generation (uses OpenAI API)
// SECURITY: Always enforced to prevent OpenAI API abuse and cost overruns
export const scriptGenerationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? 100 : 50, // 50 per minute in production
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    const user = (req as { user?: { id: string } }).user;
    return user?.id || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Script generation rate limit exceeded, please try again later',
    },
  },
});

// Stricter limit for payment/checkout endpoints
// SECURITY: Prevents creation of excessive Stripe sessions and probing attacks
export const paymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 100 : 15, // 15 checkout attempts per hour in production
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    const user = (req as { user?: { id: string } }).user;
    return user?.id || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Too many payment requests, please try again later',
    },
  },
});
