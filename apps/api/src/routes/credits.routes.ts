import { Router } from 'express';
import { creditsController } from '../controllers/credits.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate, schemas } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const creditsRoutes = Router();

creditsRoutes.get('/packages', asyncHandler(creditsController.getPackages));

creditsRoutes.get(
  '/balance',
  asyncHandler(authMiddleware),
  asyncHandler(creditsController.getBalance)
);

creditsRoutes.post(
  '/checkout',
  asyncHandler(authMiddleware),
  validate(schemas.checkout),
  asyncHandler(creditsController.createCheckout)
);

creditsRoutes.get(
  '/history',
  asyncHandler(authMiddleware),
  validate(schemas.pagination, 'query'),
  asyncHandler(creditsController.getHistory)
);
