import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
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
        error: err,
        stack: err.stack,
        path: req.path,
        method: req.method,
      },
      'Unexpected error'
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
