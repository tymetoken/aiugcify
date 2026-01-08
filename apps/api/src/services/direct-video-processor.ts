/**
 * Direct Video Processor - Development Fallback
 *
 * This module provides direct video processing without BullMQ/Redis.
 * Used when Redis is unavailable (e.g., Upstash limit exceeded).
 */

import { prisma } from '../config/database.js';
import { kieService } from './kie.service.js';
import { cloudinaryService } from './cloudinary.service.js';
import { creditsService } from './credits.service.js';
import { logger } from '../utils/logger.js';
import type { VideoStyle } from '@aiugcify/shared-types';

interface ProcessVideoInput {
  videoId: string;
  script: string;
  style: string;
  duration: number;
  productImageUrl?: string;
}

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

/**
 * Process video directly without using BullMQ queue.
 * Runs asynchronously in the background.
 */
export async function processVideoDirect(input: ProcessVideoInput): Promise<void> {
  const { videoId, script, style, productImageUrl } = input;

  logger.info({ videoId, hasProductImage: !!productImageUrl }, 'Starting direct video processing (no queue)');

  try {
    // Fetch the video record to get the master product summary
    const videoRecord = await prisma.video.findUnique({
      where: { id: videoId },
      select: { masterProductSummary: true, productTitle: true, productImages: true },
    });

    // Get the product image URL
    const imageUrl = productImageUrl || (videoRecord?.productImages?.[0] as string | undefined);

    // Step 1: Update status to GENERATING
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'GENERATING',
        generationStartedAt: new Date(),
      },
    });

    // Step 2: Create video prompt
    const videoStyle = style as VideoStyle;
    const stylePrompt = STYLE_VIDEO_PROMPTS[videoStyle](script);

    const masterSummary = videoRecord?.masterProductSummary || '';
    const videoPrompt = masterSummary
      ? `${stylePrompt}\n\nPRODUCT VISUAL REFERENCE (use to match product appearance, NOT as opening frames):\n${masterSummary}\n\nREMINDER: Start video with dynamic content immediately. The attached image is only a reference for what the product should look like in the video - do not show it as a static frame.`
      : stylePrompt;

    logger.info({ videoId, promptLength: videoPrompt.length, hasImageUrl: !!imageUrl }, 'Created video prompt');

    // Step 3: Submit to Kie.ai
    const kieJob = await kieService.createVideo({
      prompt: videoPrompt,
      imageUrl: imageUrl,
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { soraJobId: kieJob.id },
    });

    // Step 4: Poll for completion
    const videoResult = await kieService.pollUntilComplete(kieJob.id, {
      maxAttempts: 120,
      intervalMs: 10000,
    });

    // Step 5: Download video from Kie.ai
    if (!videoResult.videoUrl) {
      throw new Error('No video URL returned from Kie.ai');
    }
    const videoBuffer = await kieService.downloadVideo(videoResult.videoUrl);

    // Step 6: Upload to Cloudinary
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'PROCESSING' },
    });

    const cloudinaryResult = await cloudinaryService.uploadVideo(videoBuffer, {
      folder: 'ugc-videos',
      publicId: `video_${videoId}`,
    });

    // Step 7: Generate signed download URL (7-day expiry)
    const downloadUrl = cloudinaryService.getSignedUrl(cloudinaryResult.publicId, 7 * 24 * 3600);

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

    logger.info({ videoId }, 'Direct video processing completed successfully');
  } catch (error) {
    logger.error({ error, videoId }, 'Direct video processing failed');

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
    }

    // Update video status to FAILED
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'FAILED',
        errorMessage: userFriendlyError,
        errorCode: 'GENERATION_FAILED',
      },
    });

    // Refund the credit
    if (video && video.creditsUsed > 0) {
      try {
        await creditsService.refundCredits(video.userId, 1, videoId, 'Video generation failed - automatic refund');
        logger.info({ videoId, userId: video.userId }, 'Credit refunded due to generation failure');
      } catch (refundError) {
        logger.error({ refundError, videoId }, 'Failed to refund credit');
      }
    }
  }
}
