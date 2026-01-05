import { Router } from 'express';
import express from 'express';
import { webhooksController } from '../controllers/webhooks.controller.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const webhooksRoutes = Router();

// Stripe webhook needs raw body
// SECURITY: Limit body size to prevent memory exhaustion DoS attacks
webhooksRoutes.post(
  '/stripe',
  express.raw({ type: 'application/json', limit: '64kb' }),
  asyncHandler(webhooksController.handleStripe)
);
