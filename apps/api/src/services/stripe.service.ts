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

    // Verify customer exists in current Stripe mode, create new if not
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (err: unknown) {
        // Customer doesn't exist in current mode (live/test mismatch), create new
        logger.info({ userId, oldCustomerId: customerId }, 'Stripe customer not found in current mode, creating new');
        customerId = null;
      }
    }

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

    // Build description for one-time purchase
    const purchaseDescription = `${creditPackage.name} - ${creditPackage.credits} video credits`;

    // Create checkout session with invoice creation enabled
    // This creates an invoice for one-time purchases so they appear in Stripe billing portal
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [
        {
          price: creditPackage.stripePriceId,
          quantity: 1,
        },
      ],
      // Enable invoice creation for one-time purchases
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: purchaseDescription,
          metadata: {
            userId,
            packageId,
            packageName: creditPackage.name,
            credits: creditPackage.credits.toString(),
            bonusCredits: creditPackage.bonusCredits.toString(),
          },
        },
      },
      metadata: {
        userId,
        packageId,
        packageName: creditPackage.name,
        credits: creditPackage.credits.toString(),
        bonusCredits: creditPackage.bonusCredits.toString(),
      },
      // Pass metadata to the payment intent so it appears on charges and in Stripe dashboard
      payment_intent_data: {
        description: purchaseDescription,
        statement_descriptor_suffix: creditPackage.name.substring(0, 22), // Max 22 chars for suffix
        metadata: {
          userId,
          packageId,
          packageName: creditPackage.name,
          credits: creditPackage.credits.toString(),
          bonusCredits: creditPackage.bonusCredits.toString(),
        },
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

    // Verify customer exists in current Stripe mode, create new if not
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (err: unknown) {
        // Customer doesn't exist in current mode (live/test mismatch), create new
        logger.info({ userId, oldCustomerId: customerId }, 'Stripe customer not found in current mode, creating new');
        customerId = null;
      }
    }

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

    // Build subscription description
    const intervalLabel = interval === 'monthly' ? 'Monthly' : 'Yearly';
    const subscriptionDescription = `${plan.name} Plan (${intervalLabel}) - ${credits} video credits${bonusCredits > 0 ? ` + ${bonusCredits} bonus` : ''}`;

    // Create subscription checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        planId,
        planName: plan.name,
        interval,
        credits: credits.toString(),
        bonusCredits: bonusCredits.toString(),
        type: 'subscription',
        description: subscriptionDescription,
      },
      subscription_data: {
        description: subscriptionDescription,
        metadata: {
          userId,
          planId,
          planName: plan.name,
          interval,
          credits: credits.toString(),
          description: subscriptionDescription,
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

  async changeSubscriptionPlan(
    userId: string,
    newPlanId: string,
    newInterval: 'monthly' | 'yearly'
  ) {
    // Get existing subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      throw AppError.notFound('No active subscription found');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Cannot change plan on inactive subscription');
    }

    // Prevent changing to the same plan+interval
    if (subscription.planId === newPlanId && subscription.interval === newInterval.toUpperCase()) {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Already subscribed to this plan and interval');
    }

    // Get new plan
    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: newPlanId, isActive: true },
    });

    if (!newPlan) {
      throw new AppError(400, ErrorCodes.INVALID_PACKAGE, 'Invalid subscription plan');
    }

    // Get new price ID
    const newStripePriceId = newInterval === 'monthly'
      ? newPlan.monthlyStripePriceId
      : newPlan.yearlyStripePriceId;

    // Build subscription description for Stripe
    const newCredits = newInterval === 'monthly' ? newPlan.monthlyCredits : newPlan.yearlyCredits;
    const newIntervalLabel = newInterval === 'monthly' ? 'Monthly' : 'Yearly';
    const subscriptionDescription = `${newPlan.name} Plan (${newIntervalLabel}) - ${newCredits} video credits`;

    // Get Stripe subscription to find the subscription item ID
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const subscriptionItemId = stripeSubscription.items.data[0].id;

    // Update subscription in Stripe
    // Use 'always_invoice' to charge the prorated difference immediately on upgrade
    const updatedStripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        description: subscriptionDescription,
        items: [{
          id: subscriptionItemId,
          price: newStripePriceId,
        }],
        proration_behavior: 'always_invoice',
        payment_behavior: 'error_if_incomplete',
        metadata: {
          userId,
          planId: newPlanId,
          planName: newPlan.name,
          interval: newInterval,
          credits: newCredits.toString(),
          description: subscriptionDescription,
        },
      }
    );

    // Calculate new credits per period (for subscription record)
    const newCreditsPerPeriod = newInterval === 'monthly'
      ? newPlan.monthlyCredits
      : newPlan.yearlyCredits;

    // For upgrade credit calculation, always use MONTHLY credits
    // This is because upgrades should grant the monthly difference, not the yearly total difference
    // Example: Basic (10/mo) to Standard (30/mo) should give +20 credits, not +240 (yearly diff)
    const newMonthlyCredits = newPlan.monthlyCredits;
    const oldMonthlyCredits = subscription.plan.monthlyCredits;

    // Calculate credit difference based on monthly values
    const creditDifference = newMonthlyCredits - oldMonthlyCredits;

    // Update local subscription record and user credits in a transaction
    await prisma.$transaction(async (tx) => {
      // Update subscription
      await tx.subscription.update({
        where: { userId },
        data: {
          planId: newPlanId,
          stripePriceId: newStripePriceId,
          interval: newInterval.toUpperCase() as 'MONTHLY' | 'YEARLY',
          creditsPerPeriod: newCreditsPerPeriod,
          currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });

      // If upgrading, add the credit difference to user's balance
      if (creditDifference > 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { creditBalance: true },
        });

        if (user) {
          const newBalance = user.creditBalance + creditDifference;

          await tx.user.update({
            where: { id: userId },
            data: { creditBalance: newBalance },
          });

          // Create transaction record for the upgrade credits
          const oldIntervalLabel = subscription.interval === 'MONTHLY' ? 'Monthly' : 'Yearly';
          const newIntervalLabel = newInterval === 'monthly' ? 'Monthly' : 'Yearly';
          await tx.creditTransaction.create({
            data: {
              userId,
              type: 'SUBSCRIPTION_CREDIT',
              status: 'COMPLETED',
              amount: creditDifference,
              balanceAfter: newBalance,
              description: `Plan upgrade: ${subscription.plan.name} (${oldIntervalLabel}) → ${newPlan.name} (${newIntervalLabel}) (+${creditDifference} credits)`,
            },
          });

          logger.info(
            { userId, creditDifference, newBalance },
            'Upgrade credits allocated'
          );
        }
      }
    });

    logger.info(
      { userId, oldPlanId: subscription.planId, newPlanId, newInterval, creditDifference },
      'Subscription plan changed'
    );

    return {
      subscription: await subscriptionService.getSubscriptionStatus(userId),
      effectiveDate: new Date(),
    };
  }

  async completeCheckoutSession(sessionId: string) {
    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Payment not completed');
    }

    // Check if already processed
    const existingTransaction = await prisma.creditTransaction.findFirst({
      where: { stripeSessionId: sessionId, status: 'COMPLETED' },
    });

    if (existingTransaction) {
      // Already processed, return success
      logger.info({ sessionId }, 'Checkout session already completed');
      return { alreadyProcessed: true };
    }

    // Process the checkout completion
    await this.handleCheckoutComplete(session);

    return { success: true };
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
    // Validate metadata exists
    if (!session.metadata) {
      logger.error({ sessionId: session.id }, 'Checkout session missing metadata');
      throw new Error('Invalid checkout session: missing metadata');
    }

    const { userId, type, credits, bonusCredits } = session.metadata;

    if (!userId) {
      logger.error({ sessionId: session.id }, 'Checkout session missing userId in metadata');
      throw new Error('Invalid checkout session: missing userId');
    }

    // Handle subscription checkout
    if (type === 'subscription' || session.mode === 'subscription') {
      await this.handleSubscriptionCheckoutComplete(session);
      return;
    }

    // Validate credits for one-time purchases
    if (!credits) {
      logger.error({ sessionId: session.id }, 'One-time checkout missing credits in metadata');
      throw new Error('Invalid checkout session: missing credits');
    }

    // Handle one-time purchase
    const totalCredits = parseInt(credits, 10) + parseInt(bonusCredits || '0', 10);

    if (isNaN(totalCredits) || totalCredits <= 0) {
      logger.error({ sessionId: session.id, credits, bonusCredits }, 'Invalid credit values in metadata');
      throw new Error('Invalid checkout session: invalid credit values');
    }

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
    // Validate metadata (already checked in parent, but defensive check)
    if (!session.metadata?.userId || !session.metadata?.planId || !session.metadata?.interval) {
      logger.error({ sessionId: session.id }, 'Subscription checkout missing required metadata');
      throw new Error('Invalid subscription checkout: missing metadata');
    }

    const { userId, planId, interval } = session.metadata;
    const stripeSubscriptionId = session.subscription as string;

    if (!stripeSubscriptionId) {
      logger.error({ sessionId: session.id }, 'Subscription checkout missing subscription ID');
      throw new Error('Invalid subscription checkout: missing subscription ID');
    }

    logger.info(
      { sessionId: session.id, userId, planId, interval, stripeSubscriptionId },
      'Processing subscription checkout completion'
    );

    // Get the plan to get the correct price ID based on metadata
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new Error(`Subscription plan not found: ${planId}`);
    }

    // Use the price ID from the plan based on the interval from metadata
    // This ensures we use what was originally purchased, not what Stripe subscription currently has
    const stripePriceId = interval === 'monthly'
      ? plan.monthlyStripePriceId
      : plan.yearlyStripePriceId;

    // Get subscription period dates from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

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

      // Allocate initial credits - query by userId since we used upsert
      const subscription = await tx.subscription.findUnique({
        where: { userId },
      });

      if (subscription) {
        await subscriptionService.allocateMonthlyCredits(subscription.id, tx);
      } else {
        logger.error({ userId }, 'Subscription not found after creation');
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

    // Invoice-level idempotency check - prevent double credit allocation
    const existingAllocation = await prisma.creditTransaction.findFirst({
      where: {
        description: { contains: `Invoice: ${invoice.id}` },
        type: 'SUBSCRIPTION_CREDIT',
      },
    });

    if (existingAllocation) {
      logger.info({ invoiceId: invoice.id }, 'Invoice already processed, skipping credit allocation');
      return;
    }

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

    // Allocate monthly credits with invoice ID for tracking
    await subscriptionService.allocateMonthlyCredits(subscription.id, undefined, invoice.id);

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

    const userId = charge.metadata?.userId;
    if (!userId) {
      logger.warn({ chargeId: charge.id }, 'Refund charge missing userId metadata, cannot process');
      return;
    }

    // Find the original transaction for this payment
    const originalTransaction = await prisma.creditTransaction.findFirst({
      where: {
        stripePaymentId: charge.payment_intent as string,
        type: 'PURCHASE',
        status: 'COMPLETED',
      },
    });

    if (!originalTransaction) {
      logger.warn({ chargeId: charge.id, paymentIntent: charge.payment_intent }, 'Original transaction not found for refund');
      return;
    }

    // Check if already refunded
    const existingRefund = await prisma.creditTransaction.findFirst({
      where: {
        stripePaymentId: charge.id,
        type: 'REFUND',
      },
    });

    if (existingRefund) {
      logger.info({ chargeId: charge.id }, 'Refund already processed, skipping');
      return;
    }

    // Deduct credits (allow negative balance if credits were already used)
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });

      if (!user) {
        logger.error({ userId, chargeId: charge.id }, 'User not found for refund');
        return;
      }

      const newBalance = user.creditBalance - originalTransaction.amount;

      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: newBalance },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'REFUND',
          status: 'COMPLETED',
          amount: -originalTransaction.amount,
          balanceAfter: newBalance,
          stripePaymentId: charge.id,
          description: `Refund: ${originalTransaction.description}`,
        },
      });

      // Mark original transaction as refunded
      await tx.creditTransaction.update({
        where: { id: originalTransaction.id },
        data: { status: 'REFUNDED' },
      });
    });

    logger.info({ chargeId: charge.id, userId, amount: originalTransaction.amount }, 'Refund processed, credits deducted');
  }

  async createBillingPortalSession(userId: string, returnUrl: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (!user.stripeCustomerId) {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'No billing history available');
    }

    // Verify customer exists in Stripe
    try {
      await stripe.customers.retrieve(user.stripeCustomerId);
    } catch {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'No billing history available');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    logger.info({ userId }, 'Billing portal session created');

    return { url: session.url };
  }

  async getInvoices(userId: string, limit: number = 10) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (!user.stripeCustomerId) {
      return { invoices: [] };
    }

    // Verify customer exists in Stripe
    try {
      await stripe.customers.retrieve(user.stripeCustomerId);
    } catch {
      return { invoices: [] };
    }

    // Fetch both invoices and charges
    // Invoices: subscription payments + new one-time purchases (with invoice_creation enabled)
    // Charges: legacy one-time purchases (before invoice_creation was enabled)
    const [invoicesResult, chargesResult] = await Promise.all([
      stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit,
      }),
      stripe.charges.list({
        customer: user.stripeCustomerId,
        limit,
      }),
    ]);

    // Map invoices (subscriptions + one-time purchases with invoices)
    const invoiceItems = invoicesResult.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status as string,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      created: new Date(invoice.created * 1000),
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      description: invoice.description || this.getInvoiceDescription(invoice),
      type: 'invoice' as const,
    }));

    // Track charge IDs and payment intent IDs that are already associated with invoices
    const invoiceChargeIds = new Set(
      invoicesResult.data
        .map((inv) => {
          if (typeof inv.charge === 'string') return inv.charge;
          if (inv.charge && typeof inv.charge === 'object') return inv.charge.id;
          return null;
        })
        .filter((id): id is string => id !== null)
    );

    const invoicePaymentIntentIds = new Set(
      invoicesResult.data
        .map((inv) => {
          if (typeof inv.payment_intent === 'string') return inv.payment_intent;
          if (inv.payment_intent && typeof inv.payment_intent === 'object') return inv.payment_intent.id;
          return null;
        })
        .filter((id): id is string => id !== null)
    );

    // Map legacy charges (one-time purchases made before invoice_creation was enabled)
    const chargeItems = chargesResult.data
      .filter((charge) => {
        // Exclude charges already associated with invoices
        if (invoiceChargeIds.has(charge.id)) return false;
        // Exclude charges whose payment intent is associated with an invoice
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
        if (paymentIntentId && invoicePaymentIntentIds.has(paymentIntentId)) return false;
        // Only include successful charges
        return charge.status === 'succeeded';
      })
      .map((charge) => ({
        id: charge.id,
        number: null,
        status: charge.status === 'succeeded' ? 'paid' : charge.status,
        amountDue: charge.amount,
        amountPaid: charge.amount,
        currency: charge.currency,
        created: new Date(charge.created * 1000),
        periodStart: null,
        periodEnd: null,
        hostedInvoiceUrl: charge.receipt_url,
        invoicePdf: charge.receipt_url,
        description: charge.description || this.getChargeDescription(charge),
        type: 'charge' as const,
      }));

    // Combine and sort by date (newest first)
    const allItems = [...invoiceItems, ...chargeItems]
      .sort((a, b) => b.created.getTime() - a.created.getTime())
      .slice(0, limit);

    return { invoices: allItems };
  }

  private getInvoiceDescription(invoice: Stripe.Invoice): string {
    // Try to get plan name from subscription metadata
    if (invoice.subscription_details?.metadata?.planName) {
      const planName = invoice.subscription_details.metadata.planName;
      const interval = invoice.subscription_details.metadata.interval;
      const credits = invoice.subscription_details.metadata.credits;
      const intervalLabel = interval === 'monthly' ? 'Monthly' : interval === 'yearly' ? 'Yearly' : '';
      if (credits) {
        return `${planName} Plan (${intervalLabel}) - ${credits} video credits`;
      }
      return `${planName} Plan${intervalLabel ? ` (${intervalLabel})` : ''}`;
    }

    // Try to get from invoice metadata
    if (invoice.metadata?.planName) {
      const planName = invoice.metadata.planName;
      const interval = invoice.metadata.interval;
      const intervalLabel = interval === 'monthly' ? 'Monthly' : interval === 'yearly' ? 'Yearly' : '';
      return `${planName} Plan${intervalLabel ? ` (${intervalLabel})` : ''}`;
    }

    // Fall back to line item description
    if (invoice.lines.data.length > 0) {
      const firstLine = invoice.lines.data[0];
      return firstLine.description || firstLine.plan?.nickname || 'Subscription Payment';
    }
    return 'Subscription Payment';
  }

  private getChargeDescription(charge: Stripe.Charge): string {
    // Try to get description from metadata or charge description
    if (charge.metadata?.packageName) {
      const credits = charge.metadata.credits;
      if (credits) {
        return `${charge.metadata.packageName} - ${credits} video credits`;
      }
      return charge.metadata.packageName;
    }
    if (charge.description) {
      return charge.description;
    }
    // Try to extract from statement descriptor or other fields
    if (charge.calculated_statement_descriptor) {
      return charge.calculated_statement_descriptor;
    }
    // Format amount as a fallback description
    const amount = (charge.amount / 100).toFixed(2);
    return `Credit Purchase ($${amount})`;
  }
}

export const stripeService = new StripeService();
