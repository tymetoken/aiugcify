import { Router } from 'express';
import { videosController } from '../controllers/videos.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate, schemas } from '../middleware/validation.middleware.js';
import {
  scriptGenerationRateLimit,
  videoGenerationRateLimit,
} from '../middleware/rate-limit.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const videosRoutes = Router();

// All video routes require authentication
videosRoutes.use(asyncHandler(authMiddleware));

videosRoutes.get(
  '/',
  validate(schemas.pagination, 'query'),
  asyncHandler(videosController.list)
);

videosRoutes.post(
  '/generate-script',
  scriptGenerationRateLimit,
  validate(schemas.generateScript),
  asyncHandler(videosController.generateScript)
);

videosRoutes.get(
  '/:id',
  validate(schemas.idParam, 'params'),
  asyncHandler(videosController.get)
);

videosRoutes.put(
  '/:id/script',
  validate(schemas.idParam, 'params'),
  validate(schemas.updateScript),
  asyncHandler(videosController.updateScript)
);

videosRoutes.post(
  '/:id/confirm',
  videoGenerationRateLimit,
  validate(schemas.idParam, 'params'),
  asyncHandler(videosController.confirmGeneration)
);

videosRoutes.get(
  '/:id/download',
  validate(schemas.idParam, 'params'),
  asyncHandler(videosController.getDownload)
);

videosRoutes.delete(
  '/:id',
  validate(schemas.idParam, 'params'),
  asyncHandler(videosController.cancel)
);

videosRoutes.post(
  '/:id/retry',
  videoGenerationRateLimit,
  validate(schemas.idParam, 'params'),
  asyncHandler(videosController.retry)
);
