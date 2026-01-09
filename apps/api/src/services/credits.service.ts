import { prisma, type PrismaTransactionClient } from '../config/database.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import type { CreditPackage, CreditTransaction } from '@aiugcify/shared-types';
import type { CreditPackage as PrismaCreditPackage, CreditTransaction as PrismaCreditTransaction } from '@prisma/client';

class CreditsService {
  async getPackages(): Promise<CreditPackage[]> {
    const packages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return packages.map((pkg: PrismaCreditPackage) => ({
      id: pkg.id,
      name: pkg.name,
      credits: pkg.credits,
      priceInCents: pkg.priceInCents,
      bonusCredits: pkg.bonusCredits,
      badgeText: pkg.badgeText,
    }));
  }

  async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return user.creditBalance;
  }

  async getHistory(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ transactions: CreditTransaction[]; total: number }> {
    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.creditTransaction.count({ where: { userId } }),
    ]);

    return {
      transactions: transactions.map((t: PrismaCreditTransaction) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        createdAt: t.createdAt,
      })),
      total,
    };
  }

  async deductCredits(
    userId: string,
    amount: number,
    videoId: string,
    description: string
  ): Promise<{ success: boolean; newBalance: number }> {
    // Atomic transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });

      if (!user) {
        throw AppError.notFound('User not found');
      }

      if (user.creditBalance < amount) {
        throw new AppError(
          402,
          ErrorCodes.INSUFFICIENT_CREDITS,
          `Insufficient credits. You have ${user.creditBalance} credits, but need ${amount}.`
        );
      }

      const newBalance = user.creditBalance - amount;

      // Update balance
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: newBalance },
      });

      // Create transaction record
      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'CONSUMPTION',
          status: 'COMPLETED',
          amount: -amount,
          balanceAfter: newBalance,
          videoId,
          description,
        },
      });

      return { newBalance };
    });

    return { success: true, newBalance: result.newBalance };
  }

  async refundCredits(
    userId: string,
    amount: number,
    videoId: string,
    description: string
  ): Promise<{ success: boolean; newBalance: number }> {
    const result = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });

      if (!user) {
        throw AppError.notFound('User not found');
      }

      const newBalance = user.creditBalance + amount;

      // Update balance
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: newBalance },
      });

      // Create transaction record
      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'REFUND',
          status: 'COMPLETED',
          amount: amount,
          balanceAfter: newBalance,
          videoId,
          description,
        },
      });

      return { newBalance };
    });

    return { success: true, newBalance: result.newBalance };
  }
}

export const creditsService = new CreditsService();
