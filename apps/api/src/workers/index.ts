import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { disconnectRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { videoWorker } from './video.worker.js';

async function connectWithRetry(maxRetries = 10, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info({ attempt, maxRetries }, 'Attempting database connection...');
      await connectDatabase();
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error({ error, attempt }, 'All database connection attempts failed');
        throw error;
      }
      logger.warn({ error, attempt, nextRetryMs: delayMs }, 'Database connection failed, retrying...');
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  logger.info('=== VIDEO WORKER PROCESS STARTED ===');

  // Connect to database with retry logic
  await connectWithRetry();

  logger.info('=== VIDEO WORKER READY - Waiting for jobs ===');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down worker...');

    await videoWorker.close();
    await disconnectDatabase();
    await disconnectRedis();

    logger.info('Worker shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start worker');
  process.exit(1);
});
