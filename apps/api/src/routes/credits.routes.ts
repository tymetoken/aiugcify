import { Router } from 'express';
import { creditsController } from '../controllers/credits.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate, schemas } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const creditsRoutes = Router();

// One-time package routes
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

// Subscription routes
creditsRoutes.get(
  '/subscription/plans',
  asyncHandler(creditsController.getSubscriptionPlans)
);

creditsRoutes.get(
  '/subscription/status',
  asyncHandler(authMiddleware),
  asyncHandler(creditsController.getSubscriptionStatus)
);

creditsRoutes.post(
  '/subscription/checkout',
  asyncHandler(authMiddleware),
  validate(schemas.subscriptionCheckout),
  asyncHandler(creditsController.createSubscriptionCheckout)
);

creditsRoutes.post(
  '/subscription/cancel',
  asyncHandler(authMiddleware),
  asyncHandler(creditsController.cancelSubscription)
);

creditsRoutes.post(
  '/subscription/resume',
  asyncHandler(authMiddleware),
  asyncHandler(creditsController.resumeSubscription)
);

creditsRoutes.post(
  '/subscription/change-plan',
  asyncHandler(authMiddleware),
  validate(schemas.changePlan),
  asyncHandler(creditsController.changeSubscriptionPlan)
);
