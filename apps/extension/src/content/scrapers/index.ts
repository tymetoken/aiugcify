import type { Platform } from '@aiugcify/shared-types';
import { BaseScraper } from './base-scraper';
import { TikTokScraper } from './tiktok-scraper';
import { YouTubeScraper } from './youtube-scraper';
import { FacebookScraper } from './facebook-scraper';
import { InstagramScraper } from './instagram-scraper';
import { AmazonScraper } from './amazon-scraper';
import { ShopifyScraper } from './shopify-scraper';

// Registry of all available scrapers
// Order matters - more specific patterns should come first
const scraperInstances: BaseScraper[] = [
  new TikTokScraper(),
  new YouTubeScraper(),
  new FacebookScraper(),
  new InstagramScraper(),
  new AmazonScraper(),
  new ShopifyScraper(), // Shopify last since its pattern is more generic
];

/**
 * Detect the platform from a URL
 */
export function detectPlatform(url: string): Platform | null {
  for (const scraper of scraperInstances) {
    if (scraper.matchesUrl(url)) {
      return scraper.getPlatform();
    }
  }
  return null;
}

/**
 * Get the appropriate scraper for a given URL
 */
export function getScraperForUrl(url: string): BaseScraper | null {
  for (const scraper of scraperInstances) {
    if (scraper.matchesUrl(url)) {
      return scraper;
    }
  }
  return null;
}

/**
 * Get a scraper by platform type
 */
export function getScraperForPlatform(platform: Platform): BaseScraper | null {
  return scraperInstances.find((s) => s.getPlatform() === platform) || null;
}

/**
 * Get all supported platforms
 */
export function getSupportedPlatforms(): Platform[] {
  return scraperInstances.map((s) => s.getPlatform());
}

/**
 * Check if a URL is a supported product/content page
 */
export function isSupported(url: string): boolean {
  return detectPlatform(url) !== null;
}

// Export all scraper classes and base class
export { BaseScraper } from './base-scraper';
export { TikTokScraper } from './tiktok-scraper';
export { YouTubeScraper } from './youtube-scraper';
export { FacebookScraper } from './facebook-scraper';
export { InstagramScraper } from './instagram-scraper';
export { AmazonScraper } from './amazon-scraper';
export { ShopifyScraper } from './shopify-scraper';
