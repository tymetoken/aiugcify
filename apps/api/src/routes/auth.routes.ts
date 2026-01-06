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
