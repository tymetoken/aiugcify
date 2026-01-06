import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisConnection } from '../config/redis.js';
import { config, isDevelopment } from '../config/index.js';
import { ErrorCodes } from '../utils/errors.js';

const createStore = () => {
  try {
    return new RedisStore({
      // @ts-expect-error - RedisStore sendCommand type mismatch with ioredis
      sendCommand: async (...args: string[]) => {
        try {
          return await redisConnection.call(args[0], ...args.slice(1));
        } catch (error) {
          console.error('Redis rate limit command error:', error);
          // Return null to allow request through on Redis failure
          return null;
        }
      },
    });
  } catch (error) {
    console.error('Failed to create Redis store:', error);
    return undefined;
  }
};

// General API rate limit
export const apiRateLimit = rateLimit({
  windowMs: parseInt(config.RATE_LIMIT_WINDOW_MS, 10),
  max: isDevelopment ? 1000 : parseInt(config.RATE_LIMIT_MAX_REQUESTS, 10), // Higher limit in dev, but still enforced
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  // SECURITY: Rate limiting is always enforced, even in development
  message: {
    success: false,
    error: {
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests, please try again later',
    },
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    const user = (req as { user?: { id: string } }).user;
    return user?.id || req.ip || 'unknown';
  },
});

// Stricter limit for auth endpoints (prevent brute force)
// SECURITY: Always enforced to prevent credential stuffing attacks
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // 1000 in dev, 100 in prod per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Too many login attempts, please try again later',
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
  max: isDevelopment ? 30 : 10, // Higher limit in dev, but still enforced
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
