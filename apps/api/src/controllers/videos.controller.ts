import type { Request, Response } from 'express';
import { videosService } from '../services/videos.service.js';
import { sendSuccess, sendCreated, sendNoContent, paginate } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

class VideosController {
  async generateScript(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { productData, videoStyle, options } = req.body;

    const result = await videosService.generateScript(user.id, {
      productData,
      videoStyle,
      options,
    });

    return sendCreated(res, result);
  }

  async updateScript(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { id } = req.params;
    const { script } = req.body;

    const video = await videosService.updateScript(user.id, id, script);
    return sendSuccess(res, { video });
  }

  async confirmGeneration(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { id } = req.params;

    const video = await videosService.confirmGeneration(user.id, id);
    return sendSuccess(res, { video });
  }

  async get(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { id } = req.params;

    const video = await videosService.getVideo(user.id, id);
    return sendSuccess(res, { video });
  }

  async list(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const { videos, total } = await videosService.listVideos(user.id, page, limit);
    const result = paginate(videos, total, page, limit);

    return sendSuccess(res, { videos: result.items }, 200, result.meta);
  }

  async getDownload(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { id } = req.params;

    const downloadUrl = await videosService.getDownloadUrl(user.id, id);
    return sendSuccess(res, { downloadUrl });
  }

  async cancel(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { id } = req.params;

    await videosService.cancelVideo(user.id, id);
    return sendNoContent(res);
  }

  async retry(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { id } = req.params;

    const video = await videosService.retryVideo(user.id, id);
    return sendSuccess(res, { video });
  }
}

export const videosController = new VideosController();
