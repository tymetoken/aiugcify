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
            .loading { color: #667eea; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon" id="icon">⏳</div>
            <h1 id="title">Processing Payment...</h1>
            <p id="message">Please wait while we confirm your payment and add credits to your account.</p>
            <button class="btn" id="closeBtn" style="display: none;" onclick="closeTab()">Close this tab</button>
            <p id="subtitle" style="margin-top: 16px; font-size: 14px; color: #999; display: none;">You can now return to the extension.</p>
          </div>
          <script>
            async function completeCheckout() {
              const urlParams = new URLSearchParams(window.location.search);
              const sessionId = urlParams.get('session_id');

              if (!sessionId) {
                document.getElementById('icon').textContent = '❌';
                document.getElementById('title').textContent = 'Error';
                document.getElementById('message').textContent = 'No session ID found. Please contact support.';
                document.getElementById('message').className = 'error';
                return;
              }

              try {
                const response = await fetch('/api/v1/credits/checkout/complete/' + sessionId, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();

                if (response.ok) {
                  document.getElementById('icon').textContent = '✅';
                  document.getElementById('title').textContent = 'Payment Successful!';
                  document.getElementById('message').textContent = 'Credits have been added to your account.';
                  document.getElementById('closeBtn').style.display = 'inline-block';
                  document.getElementById('subtitle').style.display = 'block';
                } else {
                  throw new Error(data.error?.message || 'Failed to complete checkout');
                }
              } catch (error) {
                document.getElementById('icon').textContent = '❌';
                document.getElementById('title').textContent = 'Error';
                document.getElementById('message').textContent = error.message || 'Failed to process payment. Please contact support.';
                document.getElementById('message').className = 'error';
                document.getElementById('closeBtn').style.display = 'inline-block';
              }
            }

            completeCheckout();

            function closeTab() {
              // Try to close the tab
              window.close();

              // If window.close() didn't work (some browsers block it),
              // show a message to the user
              setTimeout(() => {
                document.getElementById('subtitle').textContent = 'Please close this tab manually and return to the extension.';
              }, 100);
            }
          </script>
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
        // Allow requests with no origin header (same-origin requests, server-to-server, etc.)
        // This is needed for the checkout success page which is served from this same server
        if (!origin) {
          return callback(null, true);
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
          'https://aiugcifyapi-production.up.railway.app', // API's own origin for checkout pages
        ];

        if (config.NODE_ENV === 'development') {
          allowedOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173');
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
