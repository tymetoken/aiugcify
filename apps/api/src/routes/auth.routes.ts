import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
// Rate limiting temporarily disabled for debugging
// import { authRateLimit } from '../middleware/rate-limit.middleware.js';
import { validate, schemas } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const authRoutes = Router();

authRoutes.post(
  '/register',
  // authRateLimit disabled
  validate(schemas.register),
  asyncHandler(authController.register)
);

authRoutes.post(
  '/login',
  // authRateLimit disabled
  validate(schemas.login),
  asyncHandler(authController.login)
);

authRoutes.post(
  '/refresh',
  validate(schemas.refreshToken),
  asyncHandler(authController.refresh)
);

authRoutes.post('/logout', asyncHandler(authController.logout));

authRoutes.post(
  '/google',
  // authRateLimit disabled
  validate(schemas.googleAuth),
  asyncHandler(authController.googleAuth)
);

authRoutes.get('/me', asyncHandler(authMiddleware), asyncHandler(authController.me));

// Temporary admin endpoints - REMOVE AFTER USE
authRoutes.post('/grant-developer', asyncHandler(authController.grantDeveloper));
authRoutes.post('/reset-rate-limit', asyncHandler(authController.resetRateLimit));

// Simple test endpoint to diagnose issues
authRoutes.get('/test', (_req, res) => {
  res.json({ success: true, message: 'Auth routes working', timestamp: new Date().toISOString() });
});

// POST test without any middleware
authRoutes.post('/post-test', (req, res) => {
  res.json({ success: true, body: req.body, timestamp: new Date().toISOString() });
});

// DB diagnostic endpoint
authRoutes.get('/db-test', async (_req, res) => {
  try {
    const { prisma } = await import('../config/database.js');
    // Just count users to test DB connection
    const count = await prisma.user.count();
    res.json({ success: true, userCount: count, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      stack: (error as Error).stack?.split('\n').slice(0, 5)
    });
  }
});

// Find user diagnostic endpoint
authRoutes.get('/find-user-test', async (_req, res) => {
  try {
    const { prisma } = await import('../config/database.js');
    const user = await prisma.user.findUnique({
      where: { email: 'test@test.com' }
    });
    res.json({
      success: true,
      found: !!user,
      userId: user?.id,
      hasPassword: !!user?.passwordHash,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      stack: (error as Error).stack?.split('\n').slice(0, 5)
    });
  }
});

// Detailed registration test endpoint
authRoutes.post('/register-test', asyncHandler(async (req, res): Promise<void> => {
  const steps: string[] = [];
  try {
    const { email, password, name } = req.body;
    steps.push('1. Got request body');

    const { prisma } = await import('../config/database.js');
    steps.push('2. Imported prisma');

    const existingUser = await prisma.user.findUnique({
      where: { email: email?.toLowerCase() }
    });
    steps.push(`3. Checked existing user: ${!!existingUser}`);

    if (existingUser) {
      res.json({ success: false, steps, error: 'User already exists' });
      return;
    }

    const bcrypt = await import('bcrypt');
    steps.push('4. Imported bcrypt');

    const passwordHash = await bcrypt.hash(password, 12);
    steps.push('5. Hashed password');

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        creditBalance: 5,
      },
    });
    steps.push(`6. Created user: ${user.id}`);

    const { generateTokens, getRefreshTokenExpiry } = await import('../utils/jwt.js');
    steps.push('7. Imported JWT utils');

    const tokens = generateTokens({ userId: user.id, email: user.email });
    steps.push('8. Generated tokens');

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });
    steps.push('9. Stored refresh token');

    res.json({
      success: true,
      steps,
      user: { id: user.id, email: user.email },
      hasTokens: !!tokens.accessToken
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      steps,
      error: (error as Error).message,
      stack: (error as Error).stack?.split('\n').slice(0, 8)
    });
  }
}));
