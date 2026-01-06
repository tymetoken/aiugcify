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

  // Trust proxy - required for Railway/Heroku/etc behind load balancers
  app.set('trust proxy', 1);

  // Health check - MUST be first to allow Railway health checks (before CORS/auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Payment success/cancel pages for Stripe redirects
  app.get('/checkout/success', (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Successful - AI UGCify</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { background: white; padding: 48px; border-radius: 16px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #1a1a2e; margin: 0 0 12px; font-size: 24px; }
            p { color: #666; margin: 0 0 24px; line-height: 1.6; }
            .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 600; }
            .btn:hover { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Payment Successful!</h1>
            <p>Your subscription is now active. Credits have been added to your account.</p>
            <button class="btn" onclick="window.close()">Close this tab</button>
            <p style="margin-top: 16px; font-size: 14px; color: #999;">You can now return to the extension.</p>
          </div>
        </body>
      </html>
    `);
  });

  app.get('/checkout/cancelled', (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Cancelled - AI UGCify</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { background: white; padding: 48px; border-radius: 16px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.1); max-width: 400px; }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #1a1a2e; margin: 0 0 12px; font-size: 24px; }
            p { color: #666; margin: 0 0 24px; line-height: 1.6; }
            .btn { background: #667eea; color: white; border: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 600; }
            .btn:hover { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Payment Cancelled</h1>
            <p>Your payment was cancelled. No charges were made.</p>
            <button class="btn" onclick="window.close()">Close this tab</button>
          </div>
        </body>
      </html>
    `);
  });

  // Webhook routes - MUST be before CORS and body parsing (Stripe needs raw body, no Origin header)
  app.use('/api/v1/webhooks', webhooksRoutes);

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
