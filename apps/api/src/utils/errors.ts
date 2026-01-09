export const ErrorCodes = {
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  // Credit errors
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  INVALID_PACKAGE: 'INVALID_PACKAGE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CHECKOUT_FAILED: 'CHECKOUT_FAILED',

  // Video errors
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  SCRIPT_GENERATION_FAILED: 'SCRIPT_GENERATION_FAILED',
  VIDEO_GENERATION_FAILED: 'VIDEO_GENERATION_FAILED',
  VIDEO_GENERATION_TIMEOUT: 'VIDEO_GENERATION_TIMEOUT',
  INVALID_VIDEO_STATUS: 'INVALID_VIDEO_STATUS',

  // Scraping errors
  INVALID_PRODUCT_URL: 'INVALID_PRODUCT_URL',
  SCRAPING_FAILED: 'SCRAPING_FAILED',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    isOperational = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code: ErrorCode = ErrorCodes.BAD_REQUEST) {
    return new AppError(400, code, message);
  }

  static unauthorized(message = 'Unauthorized', code: ErrorCode = ErrorCodes.UNAUTHORIZED) {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(403, ErrorCodes.UNAUTHORIZED, message);
  }

  static notFound(message = 'Not found', code: ErrorCode = ErrorCodes.NOT_FOUND) {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code: ErrorCode = ErrorCodes.BAD_REQUEST) {
    return new AppError(409, code, message);
  }

  static paymentRequired(message: string, code: ErrorCode = ErrorCodes.INSUFFICIENT_CREDITS) {
    return new AppError(402, code, message);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError(429, ErrorCodes.RATE_LIMIT_EXCEEDED, message);
  }

  static internal(message = 'Internal server error') {
    return new AppError(500, ErrorCodes.INTERNAL_ERROR, message, false);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new AppError(503, ErrorCodes.SERVICE_UNAVAILABLE, message);
  }
}
