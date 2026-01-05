import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Type for Prisma transaction client
export type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// SECURITY: Configure Prisma with appropriate timeouts to prevent DoS
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

// Default transaction timeout (30 seconds)
export const DEFAULT_TRANSACTION_TIMEOUT = 30000;

// Helper for executing queries with timeout
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TRANSACTION_TIMEOUT,
  operation = 'Database operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

prisma.$on('query' as never, (e: { query: string; duration: number }) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'Database query');
  }
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
