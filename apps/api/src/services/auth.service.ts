import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { generateTokens, verifyRefreshToken, getRefreshTokenExpiry } from '../utils/jwt.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { UserPublic, AuthTokens } from '@aiugcify/shared-types';

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

const SALT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: UserPublic;
  tokens: AuthTokens;
}

class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const { email, password, name } = input;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError(409, ErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Get free credits amount from config
    const freeCredits = parseInt(config.FREE_CREDITS_ON_SIGNUP, 10);

    // Create user with free credits
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        creditBalance: freeCredits,
      },
    });

    // Create a credit transaction for the free signup credits
    if (freeCredits > 0) {
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          type: 'BONUS',
          status: 'COMPLETED',
          amount: freeCredits,
          balanceAfter: freeCredits,
          description: 'Free signup credits',
        },
      });

      logger.info({ userId: user.id, credits: freeCredits }, 'Free signup credits granted');
    }

    // Generate tokens
    const tokens = generateTokens({ userId: user.id, email: user.email });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return {
      user: this.toPublicUser(user),
      tokens,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const { email, password } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Check if user was created via Google Auth (no password set)
    if (user.passwordHash.startsWith('google:')) {
      throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'This account uses Google Sign-In. Please use "Continue with Google" to log in.');
    }

    // Verify password
    let isValidPassword = false;
    try {
      isValidPassword = await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      // Invalid hash format - likely a corrupted password or non-bcrypt hash
      logger.error({ userId: user.id, error }, 'Password comparison failed - invalid hash format');
      throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    if (!isValidPassword) {
      throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = generateTokens({ userId: user.id, email: user.email });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return {
      user: this.toPublicUser(user),
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    // Verify token structure
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, ErrorCodes.TOKEN_INVALID, 'Invalid refresh token');
    }

    // Check if token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new AppError(401, ErrorCodes.TOKEN_INVALID, 'Refresh token not found');
    }

    if (storedToken.revokedAt) {
      throw new AppError(401, ErrorCodes.TOKEN_INVALID, 'Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new AppError(401, ErrorCodes.TOKEN_EXPIRED, 'Refresh token has expired');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const tokens = generateTokens({ userId: payload.userId, email: payload.email });

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: payload.userId,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return tokens;
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Revoke specific token
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      });
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async googleAuth(idToken: string): Promise<AuthResult> {
    // Verify the Google ID token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      logger.error({ error }, 'Google token verification failed');
      throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid Google token');
    }

    if (!payload || !payload.email) {
      throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid Google token payload');
    }

    const { email, name, sub: googleId } = payload;

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      // Existing user - log them in
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } else {
      // New user - create account with free credits
      const freeCredits = parseInt(config.FREE_CREDITS_ON_SIGNUP, 10);

      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash: `google:${googleId}`, // Mark as Google auth user
          name: name || null,
          creditBalance: freeCredits,
        },
      });

      // Create credit transaction for free signup credits
      if (freeCredits > 0) {
        await prisma.creditTransaction.create({
          data: {
            userId: user.id,
            type: 'BONUS',
            status: 'COMPLETED',
            amount: freeCredits,
            balanceAfter: freeCredits,
            description: 'Free signup credits',
          },
        });

        logger.info({ userId: user.id, credits: freeCredits }, 'Free signup credits granted (Google auth)');
      }
    }

    // Generate tokens
    const tokens = generateTokens({ userId: user.id, email: user.email });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return {
      user: this.toPublicUser(user),
      tokens,
    };
  }

  async getUser(userId: string): Promise<UserPublic> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return this.toPublicUser(user);
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    name: string | null;
    creditBalance: number;
    hasActiveSubscription?: boolean;
  }): UserPublic {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      creditBalance: user.creditBalance,
      hasActiveSubscription: user.hasActiveSubscription ?? false,
    };
  }
}

export const authService = new AuthService();
