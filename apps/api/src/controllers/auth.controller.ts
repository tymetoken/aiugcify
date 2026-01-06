import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

class AuthController {
  async register(req: Request, res: Response) {
    const { email, password, name } = req.body;
    const result = await authService.register({ email, password, name });
    return sendCreated(res, result);
  }

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return sendSuccess(res, result);
  }

  async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body;
    const tokens = await authService.refresh(refreshToken);
    return sendSuccess(res, { tokens });
  }

  async logout(req: Request, res: Response) {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    return sendNoContent(res);
  }

  async me(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const userData = await authService.getUser(user.id);
    return sendSuccess(res, { user: userData });
  }

  async googleAuth(req: Request, res: Response) {
    const { idToken } = req.body;
    const result = await authService.googleAuth(idToken);
    return sendSuccess(res, result);
  }
}

export const authController = new AuthController();
