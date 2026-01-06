import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

interface UploadOptions {
  folder?: string;
  publicId?: string;
}

interface UploadResult {
  publicId: string;
  secureUrl: string;
  thumbnailUrl: string;
  duration: number;
  width: number;
  height: number;
}

class CloudinaryService {
  async uploadVideo(buffer: Buffer, options: UploadOptions = {}): Promise<UploadResult> {
    const { folder = 'ugc-videos', publicId } = options;

    try {
      const result = await new Promise<UploadResult>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder,
            public_id: publicId,
            transformation: [
              { quality: 'auto' },
              { fetch_format: 'mp4' },
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else if (result) {
              resolve({
                publicId: result.public_id,
                secureUrl: result.secure_url,
                thumbnailUrl: this.generateThumbnailUrl(result.public_id),
                duration: result.duration || 0,
                width: result.width,
                height: result.height,
              });
            } else {
              reject(new Error('No result from Cloudinary'));
            }
          }
        );

        uploadStream.end(buffer);
      });

      logger.info({ publicId: result.publicId }, 'Video uploaded to Cloudinary');
      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to upload video to Cloudinary');
      throw new AppError(
        500,
        ErrorCodes.INTERNAL_ERROR,
        'Failed to upload video'
      );
    }
  }

  generateThumbnailUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { width: 480, height: 854, crop: 'fill' },
        { start_offset: '0' },
      ],
    });
  }

  getSignedUrl(publicId: string, expiresInSeconds: number = 7 * 24 * 3600): string {
    const expirationTime = Math.floor(Date.now() / 1000) + expiresInSeconds;

    // Use explicit transformation to transcode video to MP4/H264
    // This ensures GIF or other formats are converted to proper MP4
    // Note: We use 'upload' type with signed URL for better transformation support
    return cloudinary.url(publicId, {
      resource_type: 'video',
      type: 'upload',
      sign_url: true,
      expires_at: expirationTime,
      transformation: [
        { video_codec: 'h264' },
        { fetch_format: 'mp4' },
        { flags: 'attachment:ugc-video.mp4' }, // Force download with MP4 filename
      ],
    });
  }

  // Generate a direct MP4 URL without authentication (for public access with expiry)
  getMp4Url(publicId: string): string {
    // Build URL with transformations to force MP4 format
    return cloudinary.url(publicId, {
      resource_type: 'video',
      type: 'upload',
      transformation: [
        { video_codec: 'h264' },
        { fetch_format: 'mp4' },
      ],
    }).replace(/\.(gif|webm|mov|avi)(\?|$)/, '.mp4$2');
  }

  async deleteVideo(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'video',
      });
      logger.info({ publicId }, 'Video deleted from Cloudinary');
    } catch (error) {
      logger.error({ error, publicId }, 'Failed to delete video from Cloudinary');
      // Don't throw - this is a cleanup operation
    }
  }
}

export const cloudinaryService = new CloudinaryService();
