import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { config } from '../config/index.js';
import { prisma, type PrismaTransactionClient } from '../config/database.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { subscriptionService } from './subscription.service.js';

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
});

export interface CreateCheckoutParams {
  userId: string;
  packageId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateSubscriptionCheckoutParams {
  userId: string;
  planId: string;
  interval: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

class StripeService {
  async createCheckoutSession(params: CreateCheckoutParams) {
    const { userId, packageId, successUrl, cancelUrl } = params;

    // Get user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Get package
    const creditPackage = await prisma.creditPackage.findUnique({
      where: { id: packageId, isActive: true },
    });

    if (!creditPackage) {
      throw new AppError(400, ErrorCodes.INVALID_PACKAGE, 'Invalid credit package');
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: creditPackage.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        packageId,
        credits: creditPackage.credits.toString(),
        bonusCredits: creditPackage.bonusCredits.toString(),
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    // Create pending transaction
    await prisma.creditTransaction.create({
      data: {
        userId,
        type: 'PURCHASE',
        status: 'PENDING',
        amount: creditPackage.credits + creditPackage.bonusCredits,
        balanceAfter: user.creditBalance, // Will be updated on completion
        stripeSessionId: session.id,
        packageId,
        priceInCents: creditPackage.priceInCents,
        description: `Purchase: ${creditPackage.name} (${creditPackage.credits} credits)`,
      },
    });

    return {
      sessionId: session.id,
      checkoutUrl: session.url!,
    };
  }

  async createSubscriptionCheckout(params: CreateSubscriptionCheckoutParams) {
    const { userId, planId, interval, successUrl, cancelUrl } = params;

    // Get user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'You already have an active subscription');
    }

    // Get subscription plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId, isActive: true },
    });

    if (!plan) {
      throw new AppError(400, ErrorCodes.INVALID_PACKAGE, 'Invalid subscription plan');
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Get the appropriate price ID based on interval
    const stripePriceId = interval === 'monthly'
      ? plan.monthlyStripePriceId
      : plan.yearlyStripePriceId;

    const credits = interval === 'monthly'
      ? plan.monthlyCredits
      : plan.yearlyCredits;

    const bonusCredits = interval === 'yearly' ? plan.yearlyBonusCredits : 0;

    // Create subscription checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        planId,
        interval,
        credits: credits.toString(),
        bonusCredits: bonusCredits.toString(),
        type: 'subscription',
      },
      subscription_data: {
        metadata: {
          userId,
          planId,
          interval,
        },
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    logger.info(
      { sessionId: session.id, userId, planId, interval },
      'Subscription checkout session created'
    );

    return {
      sessionId: session.id,
      checkoutUrl: session.url!,
    };
  }

  async cancelSubscription(userId: string, cancelAtPeriodEnd: boolean = true) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw AppError.notFound('No active subscription found');
    }

    // Cancel in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    // Update local subscription
    await subscriptionService.cancelSubscription(userId, cancelAtPeriodEnd);

    logger.info({ userId, cancelAtPeriodEnd }, 'Subscription cancelled via Stripe');
  }

  async resumeSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw AppError.notFound('No subscription found');
    }

    // Resume in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update local subscription
    await subscriptionService.resumeSubscription(userId);

    logger.info({ userId }, 'Subscription resumed via Stripe');
  }

  async handleWebhook(payload: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        config.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      logger.error({ error: err }, 'Stripe webhook signature verification failed');
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Webhook signature verification failed');
    }

    // Idempotency check
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existingEvent?.processed) {
      return { received: true, duplicate: true };
    }

    // Store event
    await prisma.webhookEvent.upsert({
      where: { eventId: event.id },
      create: {
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type,
        payload: event.data as unknown as Prisma.InputJsonValue,
      },
      update: {},
    });

    // Process event
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'charge.refunded':
          await this.handleRefund(event.data.object as Stripe.Charge);
          break;
        default:
          logger.info({ eventType: event.type }, 'Unhandled Stripe event');
      }

      // Mark as processed
      await prisma.webhookEvent.update({
        where: { eventId: event.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (error) {
      await prisma.webhookEvent.update({
        where: { eventId: event.id },
        data: { error: (error as Error).message },
      });
      throw error;
    }

    return { received: true };
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const { userId, type, credits, bonusCredits } = session.metadata!;

    // Handle subscription checkout
    if (type === 'subscription' || session.mode === 'subscription') {
      await this.handleSubscriptionCheckoutComplete(session);
      return;
    }

    // Handle one-time purchase
    const totalCredits = parseInt(credits, 10) + parseInt(bonusCredits || '0', 10);

    logger.info({ sessionId: session.id, userId, totalCredits }, 'Processing checkout completion');

    // Use transaction for atomic credit update
    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      // Get current balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const newBalance = user.creditBalance + totalCredits;

      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: newBalance },
      });

      // Update transaction
      await tx.creditTransaction.update({
        where: { stripeSessionId: session.id },
        data: {
          status: 'COMPLETED',
          balanceAfter: newBalance,
          stripePaymentId: session.payment_intent as string,
        },
      });
    });

    logger.info({ sessionId: session.id, userId }, 'Checkout completed successfully');
  }

  private async handleSubscriptionCheckoutComplete(session: Stripe.Checkout.Session) {
    const { userId, planId, interval } = session.metadata!;
    const stripeSubscriptionId = session.subscription as string;

    logger.info(
      { sessionId: session.id, userId, planId, interval, stripeSubscriptionId },
      'Processing subscription checkout completion'
    );

    // Get subscription details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const stripePriceId = stripeSubscription.items.data[0].price.id;

    // Create subscription record and allocate initial credits
    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      // Create subscription
      await subscriptionService.createSubscription(
        userId,
        planId,
        interval.toUpperCase() as 'MONTHLY' | 'YEARLY',
        stripeSubscriptionId,
        stripePriceId,
        new Date(stripeSubscription.current_period_start * 1000),
        new Date(stripeSubscription.current_period_end * 1000),
        tx
      );

      // Allocate initial credits
      const subscription = await tx.subscription.findUnique({
        where: { stripeSubscriptionId },
      });

      if (subscription) {
        await subscriptionService.allocateMonthlyCredits(subscription.id, tx);
      }
    });

    logger.info(
      { sessionId: session.id, userId, stripeSubscriptionId },
      'Subscription checkout completed successfully'
    );
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = invoice.subscription as string;

    if (!stripeSubscriptionId) {
      // Not a subscription invoice
      return;
    }

    // Skip the first invoice (handled by checkout completion)
    if (invoice.billing_reason === 'subscription_create') {
      logger.info({ invoiceId: invoice.id }, 'Skipping initial subscription invoice');
      return;
    }

    logger.info(
      { invoiceId: invoice.id, stripeSubscriptionId },
      'Processing subscription invoice payment'
    );

    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      logger.warn({ stripeSubscriptionId }, 'Subscription not found for invoice');
      return;
    }

    // Update period dates
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    await prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        status: 'ACTIVE',
      },
    });

    // Allocate monthly credits
    await subscriptionService.allocateMonthlyCredits(subscription.id);

    logger.info(
      { invoiceId: invoice.id, subscriptionId: subscription.id },
      'Subscription renewal processed'
    );
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = invoice.subscription as string;

    if (!stripeSubscriptionId) {
      return;
    }

    logger.warn(
      { invoiceId: invoice.id, stripeSubscriptionId },
      'Subscription invoice payment failed'
    );

    await subscriptionService.updateSubscriptionStatus(stripeSubscriptionId, 'PAST_DUE');
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const { stripeSubscriptionId } = { stripeSubscriptionId: subscription.id };

    logger.info(
      { stripeSubscriptionId, status: subscription.status },
      'Subscription updated'
    );

    // Map Stripe status to our status
    let status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED' = 'ACTIVE';
    switch (subscription.status) {
      case 'active':
        status = 'ACTIVE';
        break;
      case 'past_due':
        status = 'PAST_DUE';
        break;
      case 'canceled':
        status = 'CANCELED';
        break;
      case 'paused':
        status = 'PAUSED';
        break;
    }

    await subscriptionService.updateSubscriptionStatus(
      stripeSubscriptionId,
      status,
      new Date(subscription.current_period_end * 1000)
    );
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    logger.info(
      { stripeSubscriptionId: subscription.id },
      'Subscription deleted'
    );

    await subscriptionService.deleteSubscription(subscription.id);
  }

  private async handleRefund(charge: Stripe.Charge) {
    logger.info({ chargeId: charge.id }, 'Processing refund');
    // TODO: Implement refund logic if needed
    // This would deduct credits if they were used after purchase
  }
}

export const stripeService = new StripeService();
