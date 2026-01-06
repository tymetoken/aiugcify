import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { apiRateLimit } from './middleware/rate-limit.middleware.js';
import { authRoutes } from './routes/auth.routes.js';
import { creditsRoutes } from './routes/credits.routes.js';
import { videosRoutes } from './routes/videos.routes.js';
import { webhooksRoutes } from './routes/webhooks.routes.js';

export function createApp() {
  const app = express();

  // Health check - MUST be first to allow Railway health checks (before CORS/auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Debug endpoint to verify deployment
  app.get('/debug-version', (_req, res) => {
    res.json({ version: '2026-01-06-v5-posttest', deployed: new Date().toISOString() });
  });

  // Security headers with strict CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", 'https://res.cloudinary.com'],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for API (allows loading images)
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin access to API
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      noSniff: true,
      xssFilter: true,
    })
  );

  // CORS - SECURITY: Strict origin validation
  app.use(
    cors({
      origin: (origin, callback) => {
        // SECURITY: Reject requests with no origin in production
        // This prevents CSRF attacks from non-browser contexts
        if (!origin) {
          if (config.NODE_ENV === 'development') {
            // Allow in development for tools like curl, Postman
            return callback(null, true);
          }
          // In production, reject requests without origin header
          return callback(new Error('Origin header required'));
        }

        // Allow Chrome extensions
        if (origin.startsWith('chrome-extension://')) {
          return callback(null, true);
        }

        // Allow configured origins
        const allowedOrigins = [
          config.FRONTEND_URL,
          'https://aiugcify.com',
          'https://www.aiugcify.com',
        ];

        if (config.NODE_ENV === 'development') {
          allowedOrigins.push('http://localhost:3000', 'http://localhost:5173');
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Webhook routes need raw body (before JSON parsing)
  app.use('/api/v1/webhooks', webhooksRoutes);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    })
  );

  // Rate limiting
  app.use('/api', apiRateLimit);

  // API routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/credits', creditsRoutes);
  app.use('/api/v1/videos', videosRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}
