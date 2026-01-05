import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { disconnectRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { videoWorker } from './video.worker.js';

async function main() {
  logger.info('Starting video generation worker...');

  // Connect to database
  await connectDatabase();

  logger.info('Video worker is running and waiting for jobs');

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
