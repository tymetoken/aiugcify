import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { authRateLimit } from '../middleware/rate-limit.middleware.js';
import { validate, schemas } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const authRoutes = Router();

authRoutes.post(
  '/register',
  authRateLimit,
  validate(schemas.register),
  asyncHandler(authController.register)
);

authRoutes.post(
  '/login',
  authRateLimit,
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
  authRateLimit,
  validate(schemas.googleAuth),
  asyncHandler(authController.googleAuth)
);

authRoutes.get('/me', asyncHandler(authMiddleware), asyncHandler(authController.me));

// Temporary admin endpoint to grant developer access
authRoutes.post('/grant-developer', asyncHandler(authController.grantDeveloper));
