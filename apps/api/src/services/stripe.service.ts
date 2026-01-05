import Stripe from 'stripe';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export interface CreateCheckoutParams {
  userId: string;
  packageId: string;
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
        payload: event.data as unknown as Stripe.Event.Data,
      },
      update: {},
    });

    // Process event
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
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
    const { userId, credits, bonusCredits } = session.metadata!;
    const totalCredits = parseInt(credits, 10) + parseInt(bonusCredits || '0', 10);

    logger.info({ sessionId: session.id, userId, totalCredits }, 'Processing checkout completion');

    // Use transaction for atomic credit update
    await prisma.$transaction(async (tx) => {
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

  private async handleRefund(charge: Stripe.Charge) {
    logger.info({ chargeId: charge.id }, 'Processing refund');
    // TODO: Implement refund logic if needed
    // This would deduct credits if they were used after purchase
  }
}

export const stripeService = new StripeService();
