/**
 * Validation Middleware Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { validate, schemas } from '../middleware/validation.middleware.js';
import type { Request, Response, NextFunction } from 'express';

describe('Validation Middleware', () => {
  const mockRes = {} as Response;
  const mockNext = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('schemas.checkout', () => {
    it('should accept valid checkout request', () => {
      const result = schemas.checkout.safeParse({
        packageId: 'starter',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.success).toBe(true);
    });

    it('should accept checkout without URLs (optional)', () => {
      const result = schemas.checkout.safeParse({
        packageId: 'starter',
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty packageId', () => {
      const result = schemas.checkout.safeParse({
        packageId: '',
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid URL format', () => {
      const result = schemas.checkout.safeParse({
        packageId: 'starter',
        successUrl: 'not-a-valid-url',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid success URL');
      }
    });
  });

  describe('schemas.subscriptionCheckout', () => {
    it('should accept valid subscription checkout', () => {
      const result = schemas.subscriptionCheckout.safeParse({
        planId: 'basic',
        interval: 'monthly',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.success).toBe(true);
    });

    it('should accept yearly interval', () => {
      const result = schemas.subscriptionCheckout.safeParse({
        planId: 'premium',
        interval: 'yearly',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid interval', () => {
      const result = schemas.subscriptionCheckout.safeParse({
        planId: 'basic',
        interval: 'weekly', // Invalid
      });

      expect(result.success).toBe(false);
    });
  });

  describe('schemas.sessionIdParam', () => {
    it('should accept valid test session ID', () => {
      const result = schemas.sessionIdParam.safeParse({
        sessionId: 'cs_test_abc123XYZ',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid live session ID', () => {
      const result = schemas.sessionIdParam.safeParse({
        sessionId: 'cs_live_abc123XYZ',
      });

      expect(result.success).toBe(true);
    });

    it('should accept session ID without mode prefix', () => {
      const result = schemas.sessionIdParam.safeParse({
        sessionId: 'cs_abc123XYZ',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid session ID format', () => {
      const result = schemas.sessionIdParam.safeParse({
        sessionId: 'invalid_session_format',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid Stripe session ID format');
      }
    });

    it('should reject empty session ID', () => {
      const result = schemas.sessionIdParam.safeParse({
        sessionId: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('schemas.changePlan', () => {
    it('should accept valid plan change request', () => {
      const result = schemas.changePlan.safeParse({
        newPlanId: 'premium',
        newInterval: 'yearly',
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty plan ID', () => {
      const result = schemas.changePlan.safeParse({
        newPlanId: '',
        newInterval: 'monthly',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('schemas.invoiceQuery', () => {
    it('should accept valid limit', () => {
      const result = schemas.invoiceQuery.safeParse({
        limit: 25,
      });

      expect(result.success).toBe(true);
    });

    it('should use default limit of 10', () => {
      const result = schemas.invoiceQuery.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('should reject limit exceeding 50', () => {
      const result = schemas.invoiceQuery.safeParse({
        limit: 100,
      });

      expect(result.success).toBe(false);
    });

    it('should coerce string limit to number', () => {
      const result = schemas.invoiceQuery.safeParse({
        limit: '20',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });
  });

  describe('schemas.generateScript', () => {
    it('should accept valid product data', () => {
      const result = schemas.generateScript.safeParse({
        productData: {
          url: 'https://shop.example.com/product/123',
          title: 'Amazing Product',
          description: 'This is an amazing product',
          price: '$19.99',
          images: ['https://example.com/image1.jpg'],
        },
        videoStyle: 'PRODUCT_SHOWCASE',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid video style', () => {
      const result = schemas.generateScript.safeParse({
        productData: {
          url: 'https://shop.example.com/product/123',
          title: 'Amazing Product',
          description: 'This is an amazing product',
          price: '$19.99',
          images: ['https://example.com/image1.jpg'],
        },
        videoStyle: 'INVALID_STYLE',
      });

      expect(result.success).toBe(false);
    });

    it('should accept valid target duration', () => {
      const result = schemas.generateScript.safeParse({
        productData: {
          url: 'https://shop.example.com/product/123',
          title: 'Amazing Product',
          description: 'This is an amazing product',
          price: '$19.99',
          images: ['https://example.com/image1.jpg'],
        },
        videoStyle: 'TALKING_HEAD',
        options: {
          targetDuration: 30,
          tone: 'enthusiastic',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid target duration', () => {
      const result = schemas.generateScript.safeParse({
        productData: {
          url: 'https://shop.example.com/product/123',
          title: 'Amazing Product',
          description: 'This is an amazing product',
          price: '$19.99',
          images: ['https://example.com/image1.jpg'],
        },
        videoStyle: 'TALKING_HEAD',
        options: {
          targetDuration: 45, // Invalid - must be 15, 20, 25, or 30
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validate middleware function', () => {
    it('should call next() for valid request', () => {
      const mockReq = {
        body: { packageId: 'starter' },
      } as Request;

      const middleware = validate(schemas.checkout, 'body');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw error for invalid request', () => {
      const mockReq = {
        body: { packageId: '' },
      } as Request;

      const middleware = validate(schemas.checkout, 'body');

      expect(() => middleware(mockReq, mockRes, mockNext)).toThrow();
    });

    it('should validate query params', () => {
      const mockReq = {
        query: { limit: '25' },
      } as unknown as Request;

      const middleware = validate(schemas.invoiceQuery, 'query');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query.limit).toBe(25); // Coerced to number
    });

    it('should validate route params', () => {
      const mockReq = {
        params: { sessionId: 'cs_test_abc123' },
      } as unknown as Request;

      const middleware = validate(schemas.sessionIdParam, 'params');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
