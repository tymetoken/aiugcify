import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError, ErrorCodes } from '../utils/errors.js';

type RequestLocation = 'body' | 'query' | 'params';

export function validate<T extends z.ZodSchema>(
  schema: T,
  location: RequestLocation = 'body'
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req[location];
    const result = schema.safeParse(data);

    if (!result.success) {
      const firstError = result.error.errors[0];
      const path = firstError.path.join('.');
      const message = path ? `${path}: ${firstError.message}` : firstError.message;

      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, message, true, {
        errors: result.error.errors,
      });
    }

    req[location] = result.data;
    next();
  };
}

// Common validation schemas
export const schemas = {
  // Auth schemas
  register: z.object({
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    name: z.string().min(2).max(100).optional(),
  }),

  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),

  refreshToken: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),

  googleAuth: z.object({
    idToken: z.string().min(1, 'Google ID token is required'),
  }),

  // Video schemas
  generateScript: z.object({
    productData: z.object({
      url: z.string().url('Invalid product URL'),
      title: z.string().min(1).max(500),
      description: z.string().max(10000),
      price: z.string(),
      originalPrice: z.string().optional(),
      discount: z.string().optional(),
      images: z.array(z.string().url()).min(1).max(20),
      reviews: z
        .array(
          z.object({
            rating: z.number().min(1).max(5),
            text: z.string(),
            author: z.string().optional(),
          })
        )
        .optional(),
      rating: z.number().min(0).max(5).optional(),
      soldCount: z.string().optional(),
      specifications: z.record(z.string()).optional(),
      shopName: z.string().optional(),
    }),
    videoStyle: z.enum(['PRODUCT_SHOWCASE', 'TALKING_HEAD', 'LIFESTYLE']),
    options: z
      .object({
        tone: z.enum(['casual', 'professional', 'enthusiastic', 'humorous']).optional(),
        targetDuration: z.union([z.literal(15), z.literal(20), z.literal(25), z.literal(30)]).optional(),
        includeCallToAction: z.boolean().optional(),
        highlightFeatures: z.array(z.string()).optional(),
        additionalNotes: z.string().max(500).optional(),
      })
      .optional(),
  }),

  updateScript: z.object({
    script: z.string().min(1).max(5000),
  }),

  // Credits schemas
  checkout: z.object({
    packageId: z.string().min(1),
    successUrl: z.string().url('Invalid success URL').optional(),
    cancelUrl: z.string().url('Invalid cancel URL').optional(),
  }),

  subscriptionCheckout: z.object({
    planId: z.string().min(1),
    interval: z.enum(['monthly', 'yearly']),
    successUrl: z.string().url('Invalid success URL').optional(),
    cancelUrl: z.string().url('Invalid cancel URL').optional(),
  }),

  changePlan: z.object({
    newPlanId: z.string().min(1),
    newInterval: z.enum(['monthly', 'yearly']),
  }),

  // Pagination schemas
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),

  // ID param
  idParam: z.object({
    id: z.string().min(1),
  }),

  // Session ID param (Stripe checkout session)
  sessionIdParam: z.object({
    sessionId: z.string()
      .min(1)
      .regex(/^cs_(test_|live_)?[a-zA-Z0-9]+$/, 'Invalid Stripe session ID format'),
  }),

  // Invoice query with limit validation
  invoiceQuery: z.object({
    limit: z.coerce.number().int().positive().max(50).default(10),
  }),
};
