import 'dotenv/config';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { disconnectRedis } from './config/redis.js';
import { logger } from './utils/logger.js';

async function main() {
  const app = createApp();

  // Connect to database
  await connectDatabase();

  // Start server
  const server = app.listen(parseInt(config.API_PORT, 10), () => {
    logger.info(
      {
        port: config.API_PORT,
        env: config.NODE_ENV,
        url: config.API_URL,
      },
      'Server started'
    );
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');

    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      logger.info('Server closed');
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});
