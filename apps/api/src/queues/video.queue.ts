import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export interface VideoJobData {
  videoId: string;
  script: string;
  style: string;
  duration: number;
  productImageUrl?: string; // Main product image for image-to-video generation
}

export const videoQueue = new Queue<VideoJobData>('video-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});

export const videoQueueEvents = new QueueEvents('video-generation', {
  connection: redisConnection,
});
