import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

export const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('connect', () => {
  logger.info('Redis connected');
});

redisConnection.on('error', (error) => {
  logger.error({ error }, 'Redis connection error');
});

redisConnection.on('close', () => {
  logger.warn('Redis connection closed');
});

export async function disconnectRedis() {
  await redisConnection.quit();
  logger.info('Redis disconnected');
}
