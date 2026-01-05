import { prisma } from '../config/database.js';
import { openaiService } from './openai.service.js';
import { creditsService } from './credits.service.js';
import { videoQueue } from '../queues/video.queue.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { ProductData, VideoStyle, Video, VideoListItem } from '@aiugcify/shared-types';

interface GenerateScriptInput {
  productData: ProductData;
  videoStyle: VideoStyle;
  options?: {
    tone?: 'casual' | 'professional' | 'enthusiastic' | 'humorous';
    targetDuration?: number;
    includeCallToAction?: boolean;
    highlightFeatures?: string[];
    additionalNotes?: string;
  };
}

interface GenerateScriptResult {
  videoId: string;
  script: string;
  estimatedDuration: number;
  suggestedScenes: Array<{
    timestamp: string;
    description: string;
    visualSuggestion: string;
  }>;
}

class VideosService {
  async generateScript(
    userId: string,
    input: GenerateScriptInput
  ): Promise<GenerateScriptResult> {
    const { productData, videoStyle, options } = input;

    // Step 1: Analyze product with Product Breakdown GPT
    logger.info({ productTitle: productData.title, userId }, 'Starting product analysis');
    const analyzedProduct = await openaiService.analyzeProduct(productData);

    // Step 2: Generate script using the analyzed product data
    logger.info({ productName: analyzedProduct.productName, userId }, 'Generating script from analyzed product');
    const scriptResult = await openaiService.generateScript(productData, videoStyle, options, analyzedProduct);

    // Create video record with analyzed product data
    const video = await prisma.video.create({
      data: {
        userId,
        status: 'SCRIPT_READY',
        productData: productData as unknown as Record<string, unknown>,
        productTitle: analyzedProduct.productName, // Use cleaned product name
        productUrl: productData.url,
        productImages: productData.images,
        productPrice: analyzedProduct.priceInfo.currentPrice,
        productDescription: analyzedProduct.productDescription,
        analyzedProductData: analyzedProduct as unknown as Record<string, unknown>,
        masterProductSummary: analyzedProduct.masterProductSummary,
        generatedScript: scriptResult.script,
        videoStyle,
        videoDuration: scriptResult.estimatedDuration,
        scriptGeneratedAt: new Date(),
      },
    });

    logger.info({ videoId: video.id, userId }, 'Script generated successfully');

    return {
      videoId: video.id,
      script: scriptResult.script,
      estimatedDuration: scriptResult.estimatedDuration,
      suggestedScenes: scriptResult.suggestedScenes,
    };
  }

  async updateScript(userId: string, videoId: string, script: string): Promise<Video> {
    const video = await this.getVideoForUser(userId, videoId);

    if (video.status !== 'SCRIPT_READY') {
      throw new AppError(
        400,
        ErrorCodes.INVALID_VIDEO_STATUS,
        'Script can only be edited when status is SCRIPT_READY'
      );
    }

    const updated = await prisma.video.update({
      where: { id: videoId },
      data: { editedScript: script },
    });

    return this.mapToVideo(updated);
  }

  async confirmGeneration(userId: string, videoId: string): Promise<Video> {
    const video = await this.getVideoForUser(userId, videoId);

    if (video.status !== 'SCRIPT_READY') {
      throw new AppError(
        400,
        ErrorCodes.INVALID_VIDEO_STATUS,
        'Can only confirm generation when status is SCRIPT_READY'
      );
    }

    // Deduct credit
    await creditsService.deductCredits(userId, 1, videoId, 'Video generation');

    // Determine final script
    const finalScript = video.editedScript || video.generatedScript;

    if (!finalScript) {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'No script available');
    }

    // Update status and add to queue
    const updated = await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'QUEUED',
        finalScript,
      },
    });

    // Get the main product image for image-to-video generation
    const productImageUrl = video.productImages?.[0];

    // Add to video generation queue
    await videoQueue.add(
      'generate-video',
      {
        videoId,
        script: finalScript,
        style: video.videoStyle,
        duration: video.videoDuration || 20,
        productImageUrl, // Pass product image for image-to-video generation
      },
      {
        jobId: `video-${videoId}`,
      }
    );

    logger.info({ videoId, userId, hasProductImage: !!productImageUrl }, 'Video queued for generation');

    return this.mapToVideo(updated);
  }

  async getVideo(userId: string, videoId: string): Promise<Video> {
    const video = await this.getVideoForUser(userId, videoId);
    return this.mapToVideo(video);
  }

  async listVideos(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ videos: VideoListItem[]; total: number }> {
    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          productTitle: true,
          videoStyle: true,
          thumbnailUrl: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.video.count({ where: { userId } }),
    ]);

    return { videos, total };
  }

  async getDownloadUrl(userId: string, videoId: string): Promise<string> {
    const video = await this.getVideoForUser(userId, videoId);

    if (video.status !== 'COMPLETED') {
      throw new AppError(
        400,
        ErrorCodes.INVALID_VIDEO_STATUS,
        'Video is not ready for download'
      );
    }

    if (!video.downloadUrl) {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Download URL not available');
    }

    if (video.downloadExpiresAt && video.downloadExpiresAt < new Date()) {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'Download link has expired');
    }

    return video.downloadUrl;
  }

  async cancelVideo(userId: string, videoId: string): Promise<void> {
    const video = await this.getVideoForUser(userId, videoId);

    // Can only cancel if not yet started or still in queue
    if (!['PENDING_SCRIPT', 'SCRIPT_READY', 'QUEUED'].includes(video.status)) {
      throw new AppError(
        400,
        ErrorCodes.INVALID_VIDEO_STATUS,
        'Cannot cancel video at this stage'
      );
    }

    // If credits were deducted (status is QUEUED), refund them
    if (video.status === 'QUEUED') {
      await creditsService.refundCredits(userId, 1, videoId, 'Video cancelled');

      // Remove from queue
      const job = await videoQueue.getJob(`video-${videoId}`);
      if (job) {
        await job.remove();
      }
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'CANCELLED' },
    });

    logger.info({ videoId, userId }, 'Video cancelled');
  }

  async retryVideo(userId: string, videoId: string): Promise<Video> {
    const video = await this.getVideoForUser(userId, videoId);

    if (video.status !== 'FAILED') {
      throw new AppError(
        400,
        ErrorCodes.INVALID_VIDEO_STATUS,
        'Can only retry failed videos'
      );
    }

    if (!video.finalScript) {
      throw new AppError(400, ErrorCodes.BAD_REQUEST, 'No script available for retry');
    }

    // Deduct another credit for retry
    await creditsService.deductCredits(userId, 1, videoId, 'Video retry');

    // Update status and re-queue
    const updated = await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        errorCode: null,
        retryCount: { increment: 1 },
      },
    });

    // Get the main product image for image-to-video generation
    const productImageUrl = video.productImages?.[0];

    await videoQueue.add(
      'generate-video',
      {
        videoId,
        script: video.finalScript,
        style: video.videoStyle,
        duration: video.videoDuration || 20,
        productImageUrl, // Pass product image for image-to-video generation
      },
      {
        jobId: `video-${videoId}-retry-${updated.retryCount}`,
      }
    );

    logger.info({ videoId, userId, hasProductImage: !!productImageUrl }, 'Video retry queued');

    return this.mapToVideo(updated);
  }

  private async getVideoForUser(userId: string, videoId: string) {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw AppError.notFound('Video not found', ErrorCodes.VIDEO_NOT_FOUND);
    }

    if (video.userId !== userId) {
      throw AppError.forbidden('Access denied');
    }

    return video;
  }

  private mapToVideo(video: {
    id: string;
    userId: string;
    status: string;
    productData: unknown;
    productTitle: string;
    productUrl: string;
    productImages: string[];
    generatedScript: string | null;
    editedScript: string | null;
    finalScript: string | null;
    videoStyle: string;
    soraJobId: string | null;
    videoDuration: number | null;
    cloudinaryPublicId: string | null;
    cloudinaryUrl: string | null;
    downloadUrl: string | null;
    downloadExpiresAt: Date | null;
    thumbnailUrl: string | null;
    errorMessage: string | null;
    creditsUsed: number;
    createdAt: Date;
    completedAt: Date | null;
  }): Video {
    return {
      id: video.id,
      userId: video.userId,
      status: video.status as Video['status'],
      productData: video.productData as ProductData,
      productTitle: video.productTitle,
      productUrl: video.productUrl,
      productImages: video.productImages,
      generatedScript: video.generatedScript,
      editedScript: video.editedScript,
      finalScript: video.finalScript,
      videoStyle: video.videoStyle as VideoStyle,
      soraJobId: video.soraJobId,
      videoDuration: video.videoDuration,
      cloudinaryPublicId: video.cloudinaryPublicId,
      cloudinaryUrl: video.cloudinaryUrl,
      downloadUrl: video.downloadUrl,
      downloadExpiresAt: video.downloadExpiresAt,
      thumbnailUrl: video.thumbnailUrl,
      errorMessage: video.errorMessage,
      creditsUsed: video.creditsUsed,
      createdAt: video.createdAt,
      completedAt: video.completedAt,
    };
  }
}

export const videosService = new VideosService();
