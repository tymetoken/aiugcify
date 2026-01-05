import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { prisma } from '../config/database.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw AppError.unauthorized('Missing token');
  }

  try {
    const payload = verifyAccessToken(token);

    // Optionally verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if ((error as Error).name === 'TokenExpiredError') {
      throw new AppError(401, ErrorCodes.TOKEN_EXPIRED, 'Token expired');
    }
    throw new AppError(401, ErrorCodes.TOKEN_INVALID, 'Invalid token');
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = {
      id: payload.userId,
      email: payload.email,
    };
  } catch {
    // Ignore token errors for optional auth
  }

  next();
}
