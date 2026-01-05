import { config } from '../config/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

interface CreateVideoParams {
  prompt: string;
  imageUrl?: string; // Optional product image for image-to-video generation
}

interface KieCreateTaskResponse {
  taskId?: string;
  task_id?: string;
  id?: string;
  jobId?: string;
  job_id?: string;
  status?: string;
  data?: {
    taskId?: string;
    task_id?: string;
    id?: string;
  };
}

interface KieRecordInfoResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    model: string;
    state: 'waiting' | 'processing' | 'completed' | 'success' | 'failed';
    param: string;
    resultJson: string;
    failCode: string | null;
    failMsg: string | null;
    costTime: number | null;
    completeTime: number | null;
    createTime: number;
  };
}

interface KieResultJson {
  resultUrls?: string[];
  videoUrl?: string;
  video_url?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  output?: {
    video_url?: string;
    videoUrl?: string;
  };
}

interface KieVideoJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  createdAt: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

interface PollOptions {
  maxAttempts?: number;
  intervalMs?: number;
  onProgress?: (progress: number) => Promise<void>;
}

class KieService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    // Base URL should be https://api.kie.ai
    this.baseUrl = config.KIE_API_BASE_URL.replace(/\/$/, '');
    this.apiKey = config.KIE_API_KEY;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    logger.debug({ url, method: options.method || 'GET' }, 'Kie.ai API request');

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    const data = await response.json() as T & { message?: string; error?: string };

    if (!response.ok) {
      logger.error({ endpoint, status: response.status, error: data }, 'Kie.ai API error');
      const errorMessage = data?.message || data?.error || 'Unknown error from Kie.ai API';
      throw new AppError(500, ErrorCodes.VIDEO_GENERATION_FAILED, errorMessage);
    }

    return data as T;
  }

  async createVideo(params: CreateVideoParams): Promise<KieVideoJob> {
    const { prompt, imageUrl } = params;

    // Determine if we should use image-to-video or text-to-video
    const useImageToVideo = !!imageUrl;
    const model = useImageToVideo ? 'sora-2-image-to-video' : 'sora-2-text-to-video';

    logger.info(
      { prompt: prompt.substring(0, 100), useImageToVideo, hasImageUrl: !!imageUrl },
      `Creating Sora 2 video via Kie.ai (${model})`
    );

    try {
      // Build the input object based on whether we have an image
      const input: Record<string, unknown> = {
        prompt: prompt,
        aspect_ratio: 'portrait',
        n_frames: '10',
        size: 'high',
        remove_watermark: true,
      };

      // Add image_urls for image-to-video model
      if (useImageToVideo && imageUrl) {
        input.image_urls = [imageUrl];
        logger.info({ imageUrl: imageUrl.substring(0, 100) }, 'Using image-to-video with product image');
      }

      // Correct endpoint: /api/v1/jobs/createTask
      // Kie.ai expects 'input' to be a JSON object with prompt inside
      const response = await this.request<KieCreateTaskResponse>('/api/v1/jobs/createTask', {
        method: 'POST',
        body: JSON.stringify({
          model,
          input,
        }),
      });

      // Log full response for debugging
      logger.info({ response: JSON.stringify(response) }, 'Kie.ai createTask full response');

      // Try multiple possible field names for task ID
      const taskId = response.taskId ||
                     response.task_id ||
                     response.id ||
                     response.jobId ||
                     response.job_id ||
                     response.data?.taskId ||
                     response.data?.task_id ||
                     response.data?.id;

      if (!taskId) {
        logger.error({ response }, 'No taskId found in Kie.ai response');
        throw new Error('No taskId returned from Kie.ai API');
      }

      logger.info({ taskId }, 'Kie.ai video task created');

      return {
        id: taskId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error({ error }, 'Failed to create video with Kie.ai');
      throw new AppError(
        500,
        ErrorCodes.VIDEO_GENERATION_FAILED,
        'Failed to start video generation'
      );
    }
  }

  async getVideoStatus(jobId: string): Promise<KieVideoJob> {
    try {
      // Correct endpoint: /api/v1/jobs/recordInfo?taskId={taskId}
      const response = await this.request<KieRecordInfoResponse>(`/api/v1/jobs/recordInfo?taskId=${jobId}`);

      const { data } = response;

      // Map Kie.ai state to our format
      let mappedStatus: KieVideoJob['status'] = 'pending';
      if (data.state === 'completed' || data.state === 'success') {
        mappedStatus = 'completed';
      } else if (data.state === 'failed') {
        mappedStatus = 'failed';
      } else if (data.state === 'processing') {
        mappedStatus = 'processing';
      } else if (data.state === 'waiting') {
        mappedStatus = 'pending';
      }

      // Parse resultJson if available
      let videoUrl: string | undefined;
      let thumbnailUrl: string | undefined;
      if (data.resultJson) {
        try {
          const result = JSON.parse(data.resultJson) as KieResultJson;
          videoUrl = result.resultUrls?.[0] || result.videoUrl || result.video_url || result.output?.video_url || result.output?.videoUrl;
          thumbnailUrl = result.thumbnailUrl || result.thumbnail_url;
        } catch {
          logger.warn({ resultJson: data.resultJson }, 'Failed to parse resultJson');
        }
      }

      return {
        id: data.taskId,
        status: mappedStatus,
        progress: data.state === 'completed' ? 100 : data.state === 'processing' ? 50 : 0,
        videoUrl,
        thumbnailUrl,
        error: data.failMsg || undefined,
        createdAt: new Date(data.createTime).toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error({ error, jobId }, 'Failed to get video status from Kie.ai');
      throw new AppError(
        500,
        ErrorCodes.VIDEO_GENERATION_FAILED,
        'Failed to check video status'
      );
    }
  }

  async pollUntilComplete(
    jobId: string,
    options: PollOptions = {}
  ): Promise<KieVideoJob> {
    const { maxAttempts = 120, intervalMs = 10000, onProgress } = options;

    let attempts = 0;
    let lastProgress = 0;

    while (attempts < maxAttempts) {
      const status = await this.getVideoStatus(jobId);

      if (status.status === 'completed') {
        logger.info({ jobId, videoUrl: status.videoUrl }, 'Kie.ai video generation completed');
        return status;
      }

      if (status.status === 'failed') {
        throw new AppError(
          500,
          ErrorCodes.VIDEO_GENERATION_FAILED,
          status.error || 'Video generation failed'
        );
      }

      // Report progress
      const currentProgress = status.progress || lastProgress;
      if (onProgress && currentProgress !== lastProgress) {
        await onProgress(currentProgress);
        lastProgress = currentProgress;
      }

      logger.debug(
        { jobId, status: status.status, progress: currentProgress, attempt: attempts },
        'Polling Kie.ai video status'
      );

      await this.sleep(intervalMs);
      attempts++;
    }

    throw new AppError(
      500,
      ErrorCodes.VIDEO_GENERATION_TIMEOUT,
      'Video generation timed out'
    );
  }

  async downloadVideo(videoUrl: string): Promise<Buffer> {
    try {
      logger.info({ videoUrl }, 'Downloading video from Kie.ai');
      const response = await fetch(videoUrl);

      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error({ error, videoUrl }, 'Failed to download video from Kie.ai');
      throw new AppError(
        500,
        ErrorCodes.VIDEO_GENERATION_FAILED,
        'Failed to download video'
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const kieService = new KieService();
