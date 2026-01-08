import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  // Log the error
  if (err instanceof AppError && err.isOperational) {
    logger.warn(
      {
        code: err.code,
        message: err.message,
        path: req.path,
        method: req.method,
      },
      'Operational error'
    );
  } else {
    logger.error(
      {
        errorName: err.name,
        errorMessage: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      },
      `Unexpected error: ${err.message}`
    );
  }

  // Handle AppError
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const firstError = err.errors[0];
    const message = `${firstError.path.join('.')}: ${firstError.message}`;
    return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, message, {
      errors: err.errors,
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, ErrorCodes.TOKEN_INVALID, 'Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, ErrorCodes.TOKEN_EXPIRED, 'Token expired');
  }

  // Handle Redis errors (rate limit exceeded, connection issues)
  if (err.name === 'ReplyError' && err.message.includes('max requests limit exceeded')) {
    logger.error({ message: err.message }, 'Redis rate limit exceeded');
    return sendError(
      res,
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
      'Service temporarily unavailable due to high traffic. Please try again in a few minutes.'
    );
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error({ prismaCode: err.code, meta: err.meta }, 'Prisma known error');
    return sendError(res, 500, ErrorCodes.INTERNAL_ERROR, `Database error: ${err.code}`);
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ message: err.message }, 'Prisma initialization error');
    return sendError(res, 503, ErrorCodes.INTERNAL_ERROR, 'Database connection failed');
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error({ message: err.message }, 'Prisma validation error');
    return sendError(res, 500, ErrorCodes.INTERNAL_ERROR, 'Database query validation failed');
  }

  // Handle unknown errors
  return sendError(
    res,
    500,
    ErrorCodes.INTERNAL_ERROR,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  );
}

export function notFoundHandler(req: Request, res: Response) {
  sendError(res, 404, ErrorCodes.NOT_FOUND, `Route ${req.method} ${req.path} not found`);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
