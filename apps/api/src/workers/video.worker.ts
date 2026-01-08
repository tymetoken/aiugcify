import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { prisma } from '../config/database.js';
import { kieService } from '../services/kie.service.js';
import { cloudinaryService } from '../services/cloudinary.service.js';
import { creditsService } from '../services/credits.service.js';
import { logger } from '../utils/logger.js';
import type { VideoJobData } from '../queues/video.queue.js';
import type { VideoStyle } from '@aiugcify/shared-types';

const STYLE_VIDEO_PROMPTS: Record<VideoStyle, (script: string) => string> = {
  PRODUCT_SHOWCASE: (script) =>
    `IMPORTANT: The attached image is a PRODUCT REFERENCE showing what the product looks like - DO NOT display this image as the first frames. Start the video IMMEDIATELY with dynamic content.

Create a sleek product showcase video with the following script. The product shown must match the reference image exactly (colors, shape, materials, details). Use clean product shots, smooth zoom transitions, animated text overlays for key features, professional lighting, and a minimal background. Start with a dynamic hook shot, not a static product image. Script: ${script}`,

  TALKING_HEAD: (script) =>
    `IMPORTANT: The attached image is a PRODUCT REFERENCE showing what the product looks like - DO NOT display this image as the first frames. Start the video IMMEDIATELY with the creator speaking.

Create a UGC-style video with a friendly presenter speaking directly to camera. The product shown must match the reference image exactly (colors, shape, materials, details). Use natural, conversational delivery, show the product while speaking about benefits. Begin with the creator already talking, not a static product shot. Script: ${script}`,

  LIFESTYLE: (script) =>
    `IMPORTANT: The attached image is a PRODUCT REFERENCE showing what the product looks like - DO NOT display this image as the first frames. Start the video IMMEDIATELY with lifestyle action.

Create a lifestyle montage video showing the product being used in real-life scenarios. The product shown must match the reference image exactly (colors, shape, materials, details). Use multiple quick cuts between scenes, ambient and aspirational aesthetics. Open with an engaging lifestyle moment, not a static product image. Script: ${script}`,
};

export const videoWorker = new Worker<VideoJobData>(
  'video-generation',
  async (job: Job<VideoJobData>) => {
    const { videoId, script, style, productImageUrl } = job.data;

    logger.info({ jobId: job.id, videoId, hasProductImage: !!productImageUrl }, 'Starting video generation');

    try {
      // Fetch the video record to get the master product summary and product images
      const videoRecord = await prisma.video.findUnique({
        where: { id: videoId },
        select: { masterProductSummary: true, productTitle: true, productImages: true },
      });

      // Get the product image URL - prefer the one passed in job data, fallback to stored images
      const imageUrl = productImageUrl || (videoRecord?.productImages?.[0] as string | undefined);

      // Step 1: Update status to GENERATING
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'GENERATING',
          generationStartedAt: new Date(),
        },
      });

      await job.updateProgress(10);

      // Step 2: Create video prompt using master product summary
      const videoStyle = style as VideoStyle;
      const stylePrompt = STYLE_VIDEO_PROMPTS[videoStyle](script);

      // Combine style prompt with master product summary for richer visual guidance
      const masterSummary = videoRecord?.masterProductSummary || '';
      const videoPrompt = masterSummary
        ? `${stylePrompt}\n\nPRODUCT VISUAL REFERENCE (use to match product appearance, NOT as opening frames):\n${masterSummary}\n\nREMINDER: Start video with dynamic content immediately. The attached image is only a reference for what the product should look like in the video - do not show it as a static frame.`
        : stylePrompt;

      logger.info(
        { videoId, promptLength: videoPrompt.length, hasImageUrl: !!imageUrl },
        'Created Sora 2 prompt with product analysis'
      );

      // Step 3: Submit to Kie.ai Sora 2 API (image-to-video if image available, otherwise text-to-video)
      const kieJob = await kieService.createVideo({
        prompt: videoPrompt,
        imageUrl: imageUrl, // Pass product image for image-to-video generation
      });

      await prisma.video.update({
        where: { id: videoId },
        data: { soraJobId: kieJob.id },
      });

      await job.updateProgress(20);

      // Step 4: Poll for completion
      const videoResult = await kieService.pollUntilComplete(kieJob.id, {
        maxAttempts: 120,
        intervalMs: 10000,
        onProgress: async (progress) => {
          // Map progress (0-100) to our progress (20-70)
          const mappedProgress = 20 + Math.floor(progress * 0.5);
          await job.updateProgress(mappedProgress);
        },
      });

      await job.updateProgress(70);

      // Step 5: Download video from Kie.ai
      if (!videoResult.videoUrl) {
        throw new Error('No video URL returned from Kie.ai');
      }
      const videoBuffer = await kieService.downloadVideo(videoResult.videoUrl);

      await job.updateProgress(80);

      // Step 6: Upload to Cloudinary
      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'PROCESSING' },
      });

      const cloudinaryResult = await cloudinaryService.uploadVideo(videoBuffer, {
        folder: 'ugc-videos',
        publicId: `video_${videoId}`,
      });

      await job.updateProgress(95);

      // Step 7: Generate signed download URL (7-day expiry)
      const downloadUrl = cloudinaryService.getSignedUrl(
        cloudinaryResult.publicId,
        7 * 24 * 3600
      );

      // Step 8: Update video record as COMPLETED
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'COMPLETED',
          cloudinaryPublicId: cloudinaryResult.publicId,
          cloudinaryUrl: cloudinaryResult.secureUrl,
          downloadUrl,
          downloadExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          thumbnailUrl: cloudinaryResult.thumbnailUrl,
          completedAt: new Date(),
        },
      });

      await job.updateProgress(100);

      logger.info({ jobId: job.id, videoId }, 'Video generation completed successfully');

      return { success: true, videoId };
    } catch (error) {
      logger.error({ error, jobId: job.id, videoId }, 'Video generation failed');

      // Get the video to get userId for refund
      const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { userId: true, creditsUsed: true },
      });

      // Format user-friendly error message
      const rawError = (error as Error).message.toLowerCase();
      let userFriendlyError = 'Video generation failed. Your credit has been refunded.';

      if (rawError.includes('timed out') || rawError.includes('timeout')) {
        userFriendlyError = 'Video generation timed out. Your credit has been refunded.';
      } else if (rawError.includes('500') || rawError.includes('upstream') || rawError.includes('service')) {
        userFriendlyError = 'Video service temporarily unavailable. Your credit has been refunded.';
      } else if (rawError.includes('no video url') || rawError.includes('no results')) {
        userFriendlyError = 'Video generation failed to complete. Your credit has been refunded.';
      } else if (rawError.includes('failed')) {
        userFriendlyError = 'Video generation failed. Your credit has been refunded.';
      }

      // Update video status to FAILED with user-friendly message
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'FAILED',
          errorMessage: userFriendlyError,
          errorCode: (error as { code?: string }).code || 'GENERATION_FAILED',
        },
      });

      // Refund the credit immediately on failure
      if (video && video.creditsUsed > 0) {
        try {
          await creditsService.refundCredits(
            video.userId,
            1,
            videoId,
            'Video generation failed - automatic refund'
          );
          logger.info({ videoId, userId: video.userId }, 'Credit refunded due to generation failure');
        } catch (refundError) {
          logger.error({ refundError, videoId }, 'Failed to refund credit');
        }
      }

      // Don't throw - we've handled the failure gracefully
      // This prevents BullMQ from auto-retrying
      return { success: false, videoId, error: userFriendlyError };
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

// Event handlers
videoWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Video job completed');
});

videoWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Video job failed');
});

videoWorker.on('error', (error) => {
  logger.error({ error }, 'Video worker error');
});
