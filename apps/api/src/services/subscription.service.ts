import { prisma, type PrismaTransactionClient } from '../config/database.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { SubscriptionPlan, UserSubscription, SubscriptionInterval } from '@aiugcify/shared-types';

class SubscriptionService {
  async getPlans(): Promise<SubscriptionPlan[]> {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      monthlyPriceInCents: plan.monthlyPriceInCents,
      monthlyCredits: plan.monthlyCredits,
      yearlyPriceInCents: plan.yearlyPriceInCents,
      yearlyCredits: plan.yearlyCredits,
      yearlyBonusCredits: plan.yearlyBonusCredits,
      features: plan.features,
      badgeText: plan.badgeText,
    }));
  }

  async getSubscriptionStatus(userId: string): Promise<UserSubscription | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      return null;
    }

    const creditsRemaining = subscription.creditsPerPeriod - subscription.creditsUsedThisPeriod;

    return {
      id: subscription.id,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        description: subscription.plan.description,
        monthlyPriceInCents: subscription.plan.monthlyPriceInCents,
        monthlyCredits: subscription.plan.monthlyCredits,
        yearlyPriceInCents: subscription.plan.yearlyPriceInCents,
        yearlyCredits: subscription.plan.yearlyCredits,
        yearlyBonusCredits: subscription.plan.yearlyBonusCredits,
        features: subscription.plan.features,
        badgeText: subscription.plan.badgeText,
      },
      status: subscription.status as UserSubscription['status'],
      interval: subscription.interval as SubscriptionInterval,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      creditsPerPeriod: subscription.creditsPerPeriod,
      creditsUsedThisPeriod: subscription.creditsUsedThisPeriod,
      creditsRemaining,
    };
  }

  async cancelSubscription(userId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw AppError.notFound('No active subscription found');
    }

    if (subscription.status === 'CANCELED') {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Subscription is already canceled');
    }

    await prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd,
        canceledAt: cancelAtPeriodEnd ? null : new Date(),
        status: cancelAtPeriodEnd ? subscription.status : 'CANCELED',
      },
    });

    // If immediate cancellation, also update user's active subscription status
    if (!cancelAtPeriodEnd) {
      await prisma.user.update({
        where: { id: userId },
        data: { hasActiveSubscription: false },
      });
    }

    logger.info({ userId, cancelAtPeriodEnd }, 'Subscription cancellation requested');
  }

  async resumeSubscription(userId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw AppError.notFound('No subscription found');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Subscription is not scheduled for cancellation');
    }

    if (subscription.status === 'CANCELED') {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Cannot resume a fully canceled subscription');
    }

    await prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });

    logger.info({ userId }, 'Subscription resumed');
  }

  async allocateMonthlyCredits(
    subscriptionId: string,
    tx?: PrismaTransactionClient
  ): Promise<void> {
    const client = tx || prisma;

    const subscription = await client.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, plan: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Calculate credits based on interval
    let credits: number;
    let bonusCredits = 0;

    if (subscription.interval === 'MONTHLY') {
      credits = subscription.plan.monthlyCredits;
    } else {
      // Yearly: distribute credits monthly (total / 12)
      credits = Math.floor(subscription.plan.yearlyCredits / 12);
      // Add bonus credits on first month of yearly subscription
      const monthsSinceStart = Math.floor(
        (new Date().getTime() - subscription.currentPeriodStart.getTime()) / (30 * 24 * 60 * 60 * 1000)
      );
      if (monthsSinceStart === 0) {
        bonusCredits = subscription.plan.yearlyBonusCredits;
      }
    }

    const totalCredits = credits + bonusCredits;
    const newBalance = subscription.user.creditBalance + totalCredits;

    // Update user balance
    await client.user.update({
      where: { id: subscription.userId },
      data: { creditBalance: newBalance },
    });

    // Reset period usage counter
    await client.subscription.update({
      where: { id: subscriptionId },
      data: {
        creditsUsedThisPeriod: 0,
        lastCreditReset: new Date(),
      },
    });

    // Create transaction record
    await client.creditTransaction.create({
      data: {
        userId: subscription.userId,
        type: 'SUBSCRIPTION_CREDIT',
        status: 'COMPLETED',
        amount: credits,
        balanceAfter: newBalance,
        description: `${subscription.plan.name} subscription - ${subscription.interval.toLowerCase()} credits`,
      },
    });

    // Create bonus transaction if applicable
    if (bonusCredits > 0) {
      await client.creditTransaction.create({
        data: {
          userId: subscription.userId,
          type: 'SUBSCRIPTION_BONUS',
          status: 'COMPLETED',
          amount: bonusCredits,
          balanceAfter: newBalance,
          description: `${subscription.plan.name} yearly subscription bonus`,
        },
      });
    }

    logger.info(
      { subscriptionId, userId: subscription.userId, credits, bonusCredits },
      'Subscription credits allocated'
    );
  }

  async createSubscription(
    userId: string,
    planId: string,
    interval: 'MONTHLY' | 'YEARLY',
    stripeSubscriptionId: string,
    stripePriceId: string,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    tx?: PrismaTransactionClient
  ): Promise<void> {
    const client = tx || prisma;

    const plan = await client.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    // Calculate credits per period
    const creditsPerPeriod = interval === 'MONTHLY'
      ? plan.monthlyCredits
      : plan.yearlyCredits;

    // Use upsert to handle existing subscriptions (e.g., from previous attempts)
    await client.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId,
        stripePriceId,
        planId,
        status: 'ACTIVE',
        interval,
        currentPeriodStart,
        currentPeriodEnd,
        creditsPerPeriod,
        creditsUsedThisPeriod: 0,
      },
      update: {
        stripeSubscriptionId,
        stripePriceId,
        planId,
        status: 'ACTIVE',
        interval,
        currentPeriodStart,
        currentPeriodEnd,
        creditsPerPeriod,
        creditsUsedThisPeriod: 0,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });

    // Update user's subscription status
    await client.user.update({
      where: { id: userId },
      data: { hasActiveSubscription: true },
    });

    logger.info(
      { userId, planId, interval, stripeSubscriptionId },
      'Subscription created/updated'
    );
  }

  async updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED',
    currentPeriodEnd?: Date
  ): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      logger.warn({ stripeSubscriptionId }, 'Subscription not found for status update');
      return;
    }

    const updateData: {
      status: typeof status;
      currentPeriodEnd?: Date;
    } = { status };

    if (currentPeriodEnd) {
      updateData.currentPeriodEnd = currentPeriodEnd;
    }

    await prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: updateData,
    });

    // Update user's active subscription flag
    const isActive = status === 'ACTIVE';
    await prisma.user.update({
      where: { id: subscription.userId },
      data: { hasActiveSubscription: isActive },
    });

    logger.info({ stripeSubscriptionId, status }, 'Subscription status updated');
  }

  async deleteSubscription(stripeSubscriptionId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      logger.warn({ stripeSubscriptionId }, 'Subscription not found for deletion');
      return;
    }

    await prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
    });

    await prisma.user.update({
      where: { id: subscription.userId },
      data: { hasActiveSubscription: false },
    });

    logger.info({ stripeSubscriptionId }, 'Subscription marked as canceled');
  }
}

export const subscriptionService = new SubscriptionService();
