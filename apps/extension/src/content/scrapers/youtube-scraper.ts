import type { ProductData, Platform, VideoMetadata, AffiliateLink } from '@aiugcify/shared-types';
import { BaseScraper, ScraperConfig } from './base-scraper';

const YOUTUBE_CONFIG: ScraperConfig = {
  platform: 'YOUTUBE_SHORTS',
  urlPatterns: [
    /youtube\.com\/shorts\//,
    /youtube\.com\/watch\?.*v=/,
    /youtu\.be\//,
  ],
  jsonPatterns: [
    /var ytInitialData = ({.*?});/s,
    /var ytInitialPlayerResponse = ({.*?});/s,
  ],
  selectors: {
    title: [
      'h1.ytd-watch-metadata yt-formatted-string',
      '#title h1 yt-formatted-string',
      'h1[class*="title"]',
      '#shorts-title',
      'yt-formatted-string.ytd-shorts-video-title-view-model',
    ],
    description: [
      '#description-inline-expander yt-attributed-string',
      '#description yt-formatted-string',
      '#description-inner',
      'ytd-text-inline-expander[slot="content"]',
    ],
    channelName: [
      '#channel-name yt-formatted-string',
      'ytd-channel-name yt-formatted-string',
      '#owner-name a',
      'ytd-shorts-video-title-view-model a[href*="/@"]',
    ],
    channelHandle: [
      '#owner-name a[href*="/@"]',
      'ytd-channel-name a[href*="/@"]',
    ],
    viewCount: [
      '#info-strings yt-formatted-string',
      '.ytd-video-primary-info-renderer #count',
      'span.yt-core-attributed-string[role="text"]',
    ],
    likeCount: [
      '#segmented-like-button button[aria-label]',
      'ytd-toggle-button-renderer[is-icon-button] yt-formatted-string',
      'like-button-view-model button[aria-label]',
    ],
  },
};

export class YouTubeScraper extends BaseScraper {
  constructor() {
    super(YOUTUBE_CONFIG);
  }

  getPlatform(): Platform {
    return 'YOUTUBE_SHORTS';
  }

  protected extractFromJson(): Omit<ProductData, 'platform'> | null {
    const scripts = document.querySelectorAll('script');

    for (const script of scripts) {
      const content = script.textContent || '';

      // Try ytInitialData
      const dataMatch = content.match(/var ytInitialData = ({.*?});/s);
      if (dataMatch) {
        try {
          const data = JSON.parse(dataMatch[1]);
          const result = this.parseYouTubeData(data);
          if (result) return result;
        } catch {
          continue;
        }
      }

      // Try ytInitialPlayerResponse
      const playerMatch = content.match(/var ytInitialPlayerResponse = ({.*?});/s);
      if (playerMatch) {
        try {
          const data = JSON.parse(playerMatch[1]);
          const result = this.parsePlayerResponse(data);
          if (result) return result;
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private parseYouTubeData(data: Record<string, unknown>): Omit<ProductData, 'platform'> | null {
    // Navigate YouTube's complex nested structure
    try {
      // For regular videos
      const videoDetails = this.findNestedValue(data, 'videoDetails') as Record<string, unknown>;
      if (videoDetails) {
        return this.extractFromVideoDetails(videoDetails);
      }

      // For shorts - look in engagementPanels or playerOverlays
      const shortsData = this.findNestedValue(data, 'shortsLockupViewModel') as Record<string, unknown>;
      if (shortsData) {
        return this.extractFromShortsData(shortsData);
      }
    } catch {
      return null;
    }

    return null;
  }

  private parsePlayerResponse(data: Record<string, unknown>): Omit<ProductData, 'platform'> | null {
    try {
      const videoDetails = data.videoDetails as Record<string, unknown>;
      if (videoDetails) {
        return this.extractFromVideoDetails(videoDetails);
      }
    } catch {
      return null;
    }
    return null;
  }

  private extractFromVideoDetails(details: Record<string, unknown>): Omit<ProductData, 'platform'> | null {
    const title = details.title as string;
    if (!title) return null;

    const description = (details.shortDescription as string) || '';
    const channelName = details.author as string;
    const videoId = details.videoId as string;
    const viewCount = details.viewCount as string;

    // Extract affiliate links from description
    const affiliateLinks = this.extractAffiliateLinks(description);

    // Extract product mentions
    const productMentions = this.extractProductMentions(description);

    // Get hashtags
    const hashtags = this.extractHashtags(description);

    // Build video metadata
    const videoMetadata: VideoMetadata = {
      videoId,
      viewCount,
      creator: channelName,
      hashtags,
      productMentions,
    };

    // Get thumbnails
    const images = this.getThumbnails(videoId);

    return {
      url: window.location.href,
      title,
      description,
      price: '', // YouTube doesn't have pricing
      images,
      videoMetadata,
      affiliateLinks: affiliateLinks.length > 0 ? affiliateLinks : undefined,
      reviews: [],
    };
  }

  private extractFromShortsData(data: Record<string, unknown>): Omit<ProductData, 'platform'> | null {
    // Shorts have a different structure
    const title =
      (this.findNestedValue(data, 'title') as string) ||
      (this.findNestedValue(data, 'accessibilityText') as string);

    if (!title) return null;

    const videoId = this.extractVideoId();
    const images = this.getThumbnails(videoId);

    return {
      url: window.location.href,
      title,
      description: '',
      price: '',
      images,
      videoMetadata: {
        videoId,
      },
      reviews: [],
    };
  }

  protected extractFromDom(): Omit<ProductData, 'platform'> | null {
    const title = this.getTextFromSelectors(this.config.selectors.title);
    if (!title) return null;

    const description = this.getTextFromSelectors(this.config.selectors.description) || '';
    const channelName = this.getTextFromSelectors(this.config.selectors.channelName);
    const viewCount = this.getTextFromSelectors(this.config.selectors.viewCount);

    // Get channel handle
    let creatorHandle: string | undefined;
    const handleEl = document.querySelector(this.config.selectors.channelHandle[0]);
    if (handleEl) {
      const href = handleEl.getAttribute('href');
      if (href) {
        const match = href.match(/@([^/?]+)/);
        if (match) creatorHandle = match[1];
      }
    }

    // Extract affiliate links
    const affiliateLinks = this.extractAffiliateLinks(description);

    // Extract product mentions
    const productMentions = this.extractProductMentions(description);

    // Get hashtags
    const hashtags = this.extractHashtags(title + ' ' + description);

    // Get video ID and thumbnails
    const videoId = this.extractVideoId();
    const images = this.getThumbnails(videoId);

    // Build video metadata
    const videoMetadata: VideoMetadata = {
      videoId,
      viewCount,
      creator: channelName,
      creatorHandle,
      hashtags,
      productMentions,
    };

    return {
      url: window.location.href,
      title,
      description,
      price: '',
      images,
      videoMetadata,
      affiliateLinks: affiliateLinks.length > 0 ? affiliateLinks : undefined,
      reviews: [],
    };
  }

  private extractVideoId(): string {
    const url = window.location.href;

    // Shorts URL: youtube.com/shorts/{videoId}
    const shortsMatch = url.match(/shorts\/([^?/]+)/);
    if (shortsMatch) return shortsMatch[1];

    // Watch URL: youtube.com/watch?v={videoId}
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) return watchMatch[1];

    // Short URL: youtu.be/{videoId}
    const shortMatch = url.match(/youtu\.be\/([^?/]+)/);
    if (shortMatch) return shortMatch[1];

    return '';
  }

  private getThumbnails(videoId: string): string[] {
    if (!videoId) return [];

    // YouTube provides multiple thumbnail resolutions
    return [
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ];
  }

  private extractAffiliateLinks(text: string): AffiliateLink[] {
    const links: AffiliateLink[] = [];
    const seen = new Set<string>();

    // Amazon affiliate links
    const amazonPattern = /https?:\/\/(?:www\.)?(?:amazon\.[a-z.]+|amzn\.to)\/[^\s)"\]]+/gi;
    const amazonMatches = text.match(amazonPattern) || [];
    for (const url of amazonMatches) {
      if (!seen.has(url)) {
        seen.add(url);
        links.push({ type: 'product', url, label: 'Amazon' });
      }
    }

    // General shop links
    const shopPatterns = [
      { pattern: /https?:\/\/(?:www\.)?shopmy\.us\/[^\s)"\]]+/gi, label: 'ShopMy' },
      { pattern: /https?:\/\/(?:www\.)?linktr\.ee\/[^\s)"\]]+/gi, label: 'Linktree' },
      { pattern: /https?:\/\/(?:www\.)?bit\.ly\/[^\s)"\]]+/gi, label: 'Link' },
      { pattern: /https?:\/\/(?:www\.)?stan\.store\/[^\s)"\]]+/gi, label: 'Stan Store' },
      { pattern: /https?:\/\/(?:www\.)?beacons\.ai\/[^\s)"\]]+/gi, label: 'Beacons' },
    ];

    for (const { pattern, label } of shopPatterns) {
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

  private extractProductMentions(text: string): string[] {
    const mentions: string[] = [];

    // Look for patterns like "using the [Product]" or "check out [Product]"
    const patterns = [
      /(?:using|with|love|recommend|favorite|the)\s+(?:the\s+)?([A-Z][A-Za-z0-9\s]+(?:Pro|Max|Plus|Mini)?)/g,
      /(?:from|by|get\s+(?:the|your))\s+([A-Z][A-Za-z0-9\s]+)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const product = match[1]?.trim();
        if (product && product.length > 2 && product.length < 50) {
          mentions.push(product);
        }
      }
    }

    return [...new Set(mentions)].slice(0, 5);
  }

  private findNestedValue(obj: unknown, key: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;

    const record = obj as Record<string, unknown>;
    if (key in record) return record[key];

    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) {
        const result = this.findNestedValue(value, key);
        if (result !== undefined) return result;
      }
    }

    return undefined;
  }
}

export const youtubeScraper = new YouTubeScraper();
