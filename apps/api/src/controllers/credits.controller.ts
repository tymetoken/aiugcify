import type { Request, Response } from 'express';
import { creditsService } from '../services/credits.service.js';
import { stripeService } from '../services/stripe.service.js';
import { subscriptionService } from '../services/subscription.service.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';
import { paginate } from '../utils/response.js';
import { config } from '../config/index.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

class CreditsController {
  async getPackages(_req: Request, res: Response) {
    const packages = await creditsService.getPackages();
    return sendSuccess(res, { packages });
  }

  async getBalance(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const balance = await creditsService.getBalance(user.id);
    return sendSuccess(res, { balance });
  }

  async createCheckout(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { packageId, successUrl, cancelUrl } = req.body;

    const result = await stripeService.createCheckoutSession({
      userId: user.id,
      packageId,
      successUrl: successUrl || `${config.FRONTEND_URL}/credits/success`,
      cancelUrl: cancelUrl || `${config.FRONTEND_URL}/credits`,
    });

    return sendSuccess(res, result);
  }

  async getHistory(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const { transactions, total } = await creditsService.getHistory(user.id, page, limit);
    const result = paginate(transactions, total, page, limit);

    return sendSuccess(res, { transactions: result.items }, 200, result.meta);
  }

  // Subscription methods
  async getSubscriptionPlans(_req: Request, res: Response) {
    const plans = await subscriptionService.getPlans();
    return sendSuccess(res, { plans });
  }

  async getSubscriptionStatus(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const subscription = await subscriptionService.getSubscriptionStatus(user.id);
    return sendSuccess(res, { subscription });
  }

  async createSubscriptionCheckout(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { planId, interval, successUrl, cancelUrl } = req.body;

    const result = await stripeService.createSubscriptionCheckout({
      userId: user.id,
      planId,
      interval,
      successUrl: successUrl || `${config.FRONTEND_URL}/credits/success`,
      cancelUrl: cancelUrl || `${config.FRONTEND_URL}/credits`,
    });

    return sendSuccess(res, result);
  }

  async cancelSubscription(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { cancelAtPeriodEnd = true } = req.body;

    await stripeService.cancelSubscription(user.id, cancelAtPeriodEnd);
    return sendNoContent(res);
  }

  async resumeSubscription(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;

    await stripeService.resumeSubscription(user.id);
    return sendNoContent(res);
  }

  async changeSubscriptionPlan(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { newPlanId, newInterval } = req.body;

    const result = await stripeService.changeSubscriptionPlan(user.id, newPlanId, newInterval);
    return sendSuccess(res, result);
  }

  async completeCheckout(req: Request, res: Response) {
    const { sessionId } = req.params;

    const result = await stripeService.completeCheckoutSession(sessionId);
    return sendSuccess(res, result);
  }

  // Billing methods
  async createBillingPortalSession(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { returnUrl } = req.body;

    const result = await stripeService.createBillingPortalSession(
      user.id,
      returnUrl || `${config.FRONTEND_URL}/credits`
    );
    return sendSuccess(res, result);
  }

  async getInvoices(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const result = await stripeService.getInvoices(user.id, limit);
    return sendSuccess(res, result);
  }
}

export const creditsController = new CreditsController();
