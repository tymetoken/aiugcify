import type { Request, Response } from 'express';
import { creditsService } from '../services/credits.service.js';
import { stripeService } from '../services/stripe.service.js';
import { sendSuccess } from '../utils/response.js';
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
    const { page, limit } = req.query as { page: number; limit: number };

    const { transactions, total } = await creditsService.getHistory(user.id, page, limit);
    const result = paginate(transactions, total, page, limit);

    return sendSuccess(res, { transactions: result.items }, 200, result.meta);
  }
}

export const creditsController = new CreditsController();
