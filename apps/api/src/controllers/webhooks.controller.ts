import type { Request, Response } from 'express';
import { stripeService } from '../services/stripe.service.js';
import { sendSuccess } from '../utils/response.js';
import { AppError, ErrorCodes } from '../utils/errors.js';

class WebhooksController {
  async handleStripe(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Missing stripe-signature header');
    }

    const result = await stripeService.handleWebhook(req.body, signature);
    return sendSuccess(res, result);
  }
}

export const webhooksController = new WebhooksController();
