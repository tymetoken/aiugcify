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

// SECURITY: Helper to set security headers for static HTML pages
function setSecurityHeaders(res: express.Response) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
}

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
    setSecurityHeaders(res);
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
    setSecurityHeaders(res);
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

  // Privacy Policy page (required for Chrome Web Store)
  app.get('/privacy', (_req, res) => {
    setSecurityHeaders(res);
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Privacy Policy - AI UGCify</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #333; margin: 0; padding: 0; background: #f8f9fa; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 60px 20px; text-align: center; }
            .header h1 { margin: 0 0 10px; font-size: 2.5rem; }
            .header p { margin: 0; opacity: 0.9; }
            .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; background: white; min-height: calc(100vh - 200px); }
            h2 { color: #1a1a2e; margin-top: 40px; padding-bottom: 10px; border-bottom: 2px solid #667eea; }
            h3 { color: #444; margin-top: 25px; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; }
            .highlight { background: #f0f4ff; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0; }
            .footer { text-align: center; padding: 30px; color: #666; font-size: 14px; }
            a { color: #667eea; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Privacy Policy</h1>
            <p>AI UGCify - TikTok Shop Video Generator</p>
          </div>
          <div class="container">
            <p><strong>Last Updated:</strong> January 2025</p>

            <div class="highlight">
              <strong>Summary:</strong> We collect only the data necessary to provide our service. We do not sell your personal information to third parties.
            </div>

            <h2>1. Information We Collect</h2>

            <h3>Account Information</h3>
            <ul>
              <li><strong>Email address</strong> - Used for account creation and communication</li>
              <li><strong>Name</strong> (optional) - For personalization</li>
              <li><strong>Password</strong> - Securely hashed, never stored in plain text</li>
            </ul>

            <h3>Product Data (Temporary)</h3>
            <ul>
              <li>When you use the extension on TikTok Shop product pages, we temporarily process product information (title, description, price, images) to generate your video script</li>
              <li>This data is used only for video generation and is not permanently stored</li>
            </ul>

            <h3>Payment Information</h3>
            <ul>
              <li>Payment processing is handled securely by <strong>Stripe</strong></li>
              <li>We do not store your credit card numbers or banking details</li>
              <li>We receive only transaction confirmations and subscription status from Stripe</li>
            </ul>

            <h3>Generated Content</h3>
            <ul>
              <li>Video scripts you generate</li>
              <li>Completed videos (stored temporarily for download)</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>To provide and improve our video generation service</li>
              <li>To process payments and manage subscriptions</li>
              <li>To communicate important service updates</li>
              <li>To provide customer support</li>
            </ul>

            <h2>3. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul>
              <li><strong>Google OAuth</strong> - For secure sign-in (if you choose Google login)</li>
              <li><strong>Stripe</strong> - For secure payment processing</li>
              <li><strong>OpenAI</strong> - For AI-powered script generation</li>
              <li><strong>Cloudinary</strong> - For secure media storage</li>
            </ul>
            <p>Each service has its own privacy policy governing how they handle data.</p>

            <h2>4. Data Security</h2>
            <ul>
              <li>All data transmission is encrypted using HTTPS/TLS</li>
              <li>Passwords are hashed using industry-standard algorithms</li>
              <li>Access tokens expire regularly and can be revoked</li>
              <li>We do not store sensitive payment information</li>
            </ul>

            <h2>5. Data Retention</h2>
            <ul>
              <li><strong>Account data:</strong> Retained while your account is active</li>
              <li><strong>Generated videos:</strong> Available for download for 7 days, then automatically deleted</li>
              <li><strong>Payment records:</strong> Retained as required for legal/tax purposes</li>
            </ul>

            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your data</li>
            </ul>
            <p>To exercise these rights, contact us at <a href="mailto:support@aiugcify.com">support@aiugcify.com</a></p>

            <h2>7. Chrome Extension Permissions</h2>
            <p>Our extension requests the following permissions:</p>
            <ul>
              <li><strong>storage</strong> - To save your login session locally</li>
              <li><strong>activeTab</strong> - To detect when you're on a TikTok Shop product page</li>
              <li><strong>scripting</strong> - To extract product information from the page</li>
              <li><strong>downloads</strong> - To save generated videos to your computer</li>
              <li><strong>notifications</strong> - To alert you when videos are ready</li>
              <li><strong>identity</strong> - For Google OAuth sign-in</li>
            </ul>

            <h2>8. Children's Privacy</h2>
            <p>Our service is not intended for users under 13 years of age. We do not knowingly collect information from children.</p>

            <h2>9. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. We will notify you of significant changes via email or through the extension.</p>

            <h2>10. Contact Us</h2>
            <p>If you have questions about this privacy policy, please contact us:</p>
            <ul>
              <li>Email: <a href="mailto:support@aiugcify.com">support@aiugcify.com</a></li>
            </ul>
          </div>
          <div class="footer">
            &copy; 2025 AI UGCify. All rights reserved.
          </div>
        </body>
      </html>
    `);
  });

  // Terms of Service page
  app.get('/terms', (_req, res) => {
    setSecurityHeaders(res);
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Terms of Service - AI UGCify</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #333; margin: 0; padding: 0; background: #f8f9fa; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 60px 20px; text-align: center; }
            .header h1 { margin: 0 0 10px; font-size: 2.5rem; }
            .header p { margin: 0; opacity: 0.9; }
            .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; background: white; min-height: calc(100vh - 200px); }
            h2 { color: #1a1a2e; margin-top: 40px; padding-bottom: 10px; border-bottom: 2px solid #667eea; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; }
            .footer { text-align: center; padding: 30px; color: #666; font-size: 14px; }
            a { color: #667eea; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Terms of Service</h1>
            <p>AI UGCify - TikTok Shop Video Generator</p>
          </div>
          <div class="container">
            <p><strong>Last Updated:</strong> January 2025</p>

            <h2>1. Acceptance of Terms</h2>
            <p>By using AI UGCify, you agree to these Terms of Service. If you do not agree, please do not use our service.</p>

            <h2>2. Description of Service</h2>
            <p>AI UGCify is a Chrome extension that generates AI-powered UGC (User Generated Content) style marketing videos from TikTok Shop product listings.</p>

            <h2>3. Account Registration</h2>
            <ul>
              <li>You must provide accurate information when creating an account</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must be at least 13 years old to use this service</li>
            </ul>

            <h2>4. Credits and Payments</h2>
            <ul>
              <li>Video generation requires credits, which can be purchased or earned through subscriptions</li>
              <li>Credits are non-refundable once used</li>
              <li>Subscription payments are processed by Stripe and subject to their terms</li>
              <li>You may cancel subscriptions at any time; access continues until the end of the billing period</li>
            </ul>

            <h2>5. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul>
              <li>Use the service to generate misleading or fraudulent content</li>
              <li>Violate any applicable laws or TikTok's terms of service</li>
              <li>Attempt to reverse engineer or exploit the service</li>
              <li>Share your account credentials with others</li>
              <li>Use automated tools to abuse the service</li>
            </ul>

            <h2>6. Intellectual Property</h2>
            <ul>
              <li>You retain rights to content you create using our service</li>
              <li>You are responsible for ensuring you have rights to use product information</li>
              <li>AI UGCify and its branding are our intellectual property</li>
            </ul>

            <h2>7. Disclaimers</h2>
            <ul>
              <li>The service is provided "as is" without warranties</li>
              <li>We do not guarantee video quality or suitability for any purpose</li>
              <li>We are not responsible for how you use generated videos</li>
            </ul>

            <h2>8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, AI UGCify shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>

            <h2>9. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms or engage in abusive behavior.</p>

            <h2>10. Changes to Terms</h2>
            <p>We may update these terms from time to time. Continued use of the service constitutes acceptance of updated terms.</p>

            <h2>11. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:support@aiugcify.com">support@aiugcify.com</a></p>
          </div>
          <div class="footer">
            &copy; 2025 AI UGCify. All rights reserved.
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
