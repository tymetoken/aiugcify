import type { ProductData, Platform, VideoMetadata, AffiliateLink } from '@aiugcify/shared-types';
import { BaseScraper, ScraperConfig } from './base-scraper';

const FACEBOOK_CONFIG: ScraperConfig = {
  platform: 'FACEBOOK_REELS',
  urlPatterns: [
    /facebook\.com\/reel\//,
    /facebook\.com\/watch\//,
    /fb\.watch\//,
    /facebook\.com\/.*\/videos\//,
  ],
  selectors: {
    title: [
      '[data-ad-preview="message"]',
      '[dir="auto"][style*="webkit-line-clamp"]',
      'span[dir="auto"]',
      '[data-testid="post_message"]',
    ],
    username: [
      'h2 a[role="link"]',
      '[data-hovercard] strong',
      'a[aria-label][role="link"] span',
    ],
    description: [
      '[data-ad-preview="message"]',
      '[dir="auto"]',
      'span[dir="auto"]',
    ],
    viewCount: [
      'span[aria-label*="views"]',
      'span[aria-label*="Views"]',
    ],
    images: [
      'video[poster]',
      'img[src*="fbcdn"]',
    ],
  },
};

export class FacebookScraper extends BaseScraper {
  constructor() {
    super(FACEBOOK_CONFIG);
  }

  getPlatform(): Platform {
    return 'FACEBOOK_REELS';
  }

  protected extractFromJson(): Omit<ProductData, 'platform'> | null {
    // Facebook uses a complex GraphQL-based system
    // Most data is loaded via XHR/Relay, not in initial page HTML
    // We'll rely more heavily on DOM extraction for Facebook

    const scripts = document.querySelectorAll('script');

    for (const script of scripts) {
      const content = script.textContent || '';

      // Look for require patterns that might contain video data
      const requireMatch = content.match(/"video":\s*(\{[^}]+\})/);
      if (requireMatch) {
        try {
          const data = JSON.parse(requireMatch[1]);
          if (data.title || data.description) {
            return this.parseVideoData(data);
          }
        } catch {
          continue;
        }
      }

      // Look for comet data
      const cometMatch = content.match(/__comet_req_[\d]+_/);
      if (cometMatch) {
        // Facebook's Comet framework - data is heavily obfuscated
        continue;
      }
    }

    return null;
  }

  private parseVideoData(data: Record<string, unknown>): Omit<ProductData, 'platform'> | null {
    const title = (data.title as string) || (data.description as string);
    if (!title) return null;

    const images: string[] = [];
    if (data.thumbnail_url) {
      images.push(data.thumbnail_url as string);
    }

    return {
      url: window.location.href,
      title,
      description: (data.description as string) || '',
      price: '',
      images,
      reviews: [],
    };
  }

  protected extractFromDom(): Omit<ProductData, 'platform'> | null {
    // Facebook's DOM is heavily obfuscated
    // We use aria-labels, data attributes, and structural patterns

    // Get title/caption from multiple sources
    let title = this.extractCaption();

    // Try meta tags if no caption found
    if (!title) {
      title = this.getMetaContent('og:title') || '';
    }

    if (!title) {
      title = this.getMetaContent('og:description') || '';
    }

    if (!title) {
      title = 'Facebook Reel';
    }

    // Get username/creator
    const username = this.extractUsername();

    // Get images (video poster/thumbnail)
    const images = this.extractImages();

    // Get view count
    const viewCount = this.extractViewCount();

    // Extract affiliate links from caption
    const affiliateLinks = this.extractAffiliateLinks(title);

    // Get hashtags
    const hashtags = this.extractHashtags(title);

    // Build video metadata
    const videoMetadata: VideoMetadata = {
      videoId: this.extractVideoId(),
      viewCount,
      creator: username,
      hashtags,
    };

    return {
      url: window.location.href,
      title: this.truncateTitle(title),
      description: title,
      price: '',
      images,
      shopName: username,
      videoMetadata,
      affiliateLinks: affiliateLinks.length > 0 ? affiliateLinks : undefined,
      reviews: [],
    };
  }

  private extractCaption(): string {
    // Facebook uses span[dir="auto"] for most text content
    // We need to find the main caption, not UI elements

    // Method 1: Look for the main post message
    const messageElement = document.querySelector('[data-ad-preview="message"]');
    if (messageElement?.textContent) {
      return messageElement.textContent.trim();
    }

    // Method 2: Look for longer text spans (captions tend to be longer)
    const spans = document.querySelectorAll('span[dir="auto"]');
    let longestText = '';
    let longestLength = 0;

    spans.forEach((span) => {
      const text = span.textContent?.trim() || '';
      // Skip very short text (likely UI elements)
      // Skip text that looks like metrics (e.g., "1.2K", "Share")
      if (
        text.length > 20 &&
        text.length > longestLength &&
        !text.match(/^[\d.]+[KMB]?$/) &&
        !['Share', 'Like', 'Comment', 'Send'].includes(text)
      ) {
        longestText = text;
        longestLength = text.length;
      }
    });

    return longestText;
  }

  private extractUsername(): string {
    // Try to find username from profile link
    const profileLinks = document.querySelectorAll('a[role="link"][href*="facebook.com/"]');

    for (const link of profileLinks) {
      const href = link.getAttribute('href') || '';
      // Skip non-profile links
      if (
        href.includes('/reel/') ||
        href.includes('/watch/') ||
        href.includes('/videos/') ||
        href.includes('/photo') ||
        href.includes('/share')
      ) {
        continue;
      }

      // Extract username from profile URL
      const match = href.match(/facebook\.com\/([^/?]+)/);
      if (match && match[1] && !['watch', 'reel', 'reels', 'video'].includes(match[1])) {
        // Try to get display name from the link
        const displayName = link.textContent?.trim();
        if (displayName && displayName.length > 1 && displayName.length < 100) {
          return displayName;
        }
        return match[1];
      }
    }

    // Fallback: try h2 elements (often contain page/user name)
    const h2 = document.querySelector('h2');
    if (h2?.textContent) {
      const text = h2.textContent.trim();
      if (text.length < 100) {
        return text;
      }
    }

    return '';
  }

  private extractImages(): string[] {
    const images: string[] = [];
    const seen = new Set<string>();

    // Method 1: Video poster
    const video = document.querySelector('video');
    if (video?.poster && !seen.has(video.poster)) {
      seen.add(video.poster);
      images.push(video.poster);
    }

    // Method 2: og:image
    const ogImage = this.getMetaContent('og:image');
    if (ogImage && !seen.has(ogImage)) {
      seen.add(ogImage);
      images.push(ogImage);
    }

    // Method 3: Facebook CDN images
    const fbImages = document.querySelectorAll('img[src*="fbcdn"]');
    fbImages.forEach((el) => {
      const img = el as HTMLImageElement;
      const src = img.src;
      // Skip small images (profile pics, icons)
      if (
        src &&
        !seen.has(src) &&
        !src.includes('_s.') &&
        !src.includes('_t.') &&
        img.width > 100
      ) {
        seen.add(src);
        images.push(src);
      }
    });

    return images.slice(0, 5);
  }

  private extractViewCount(): string | undefined {
    // Look for view count in aria-labels
    const viewElements = document.querySelectorAll('[aria-label*="view"], [aria-label*="View"]');
    for (const el of viewElements) {
      const label = el.getAttribute('aria-label') || '';
      const match = label.match(/([\d,.]+[KMB]?)\s*views?/i);
      if (match) {
        return match[1];
      }
    }

    // Look in text content
    const allText = document.body.innerText;
    const viewMatch = allText.match(/([\d,.]+[KMB]?)\s*views/i);
    if (viewMatch) {
      return viewMatch[1];
    }

    return undefined;
  }

  private extractVideoId(): string {
    const url = window.location.href;

    // Reel URL: facebook.com/reel/{reelId}
    const reelMatch = url.match(/\/reel\/(\d+)/);
    if (reelMatch) return reelMatch[1];

    // Watch URL: facebook.com/watch/?v={videoId}
    const watchMatch = url.match(/[?&]v=(\d+)/);
    if (watchMatch) return watchMatch[1];

    // Videos URL: facebook.com/{page}/videos/{videoId}
    const videosMatch = url.match(/\/videos\/(\d+)/);
    if (videosMatch) return videosMatch[1];

    return '';
  }

  private extractAffiliateLinks(text: string): AffiliateLink[] {
    const links: AffiliateLink[] = [];
    const seen = new Set<string>();

    const patterns = [
      { pattern: /https?:\/\/(?:www\.)?amazon\.[a-z.]+\/[^\s)"\]]+/gi, label: 'Amazon' },
      { pattern: /https?:\/\/(?:www\.)?shopmy\.us\/[^\s)"\]]+/gi, label: 'ShopMy' },
      { pattern: /https?:\/\/(?:www\.)?linktr\.ee\/[^\s)"\]]+/gi, label: 'Linktree' },
      { pattern: /https?:\/\/(?:www\.)?bit\.ly\/[^\s)"\]]+/gi, label: 'Link' },
    ];

    for (const { pattern, label } of patterns) {
      const matches = text.match(pattern) || [];
      for (const url of matches) {
        if (!seen.has(url)) {
          seen.add(url);
          links.push({ type: 'product', url, label });
        }
      }
    }

    return links;
  }

  private truncateTitle(title: string): string {
    const maxLength = 200;
    if (title.length <= maxLength) return title;

    const truncated = title.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength - 50) {
      return truncated.slice(0, lastSpace) + '...';
    }
    return truncated + '...';
  }
}

export const facebookScraper = new FacebookScraper();
