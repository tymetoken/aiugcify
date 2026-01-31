import type { ProductData, Platform, VideoMetadata, AffiliateLink } from '@aiugcify/shared-types';
import { BaseScraper, ScraperConfig } from './base-scraper';

const INSTAGRAM_CONFIG: ScraperConfig = {
  platform: 'INSTAGRAM_REELS',
  urlPatterns: [
    /instagram\.com\/reel\//,
    /instagram\.com\/reels\//,
    /instagram\.com\/p\//,
  ],
  jsonPatterns: [
    /window\._sharedData\s*=\s*({.*?});/s,
    /window\.__additionalDataLoaded\s*\([^,]+,\s*({.*?})\);/s,
  ],
  selectors: {
    title: [
      'h1._ap3a',
      'h1._aacl._aaco._aacu._aacx._aad7._aade',
      'span._ap3a._aaco._aacu._aacx._aad7._aade',
      '[data-testid="post-content"] span',
    ],
    username: [
      'header a[href^="/"] span',
      'a[href^="/"][role="link"] span',
      '.x1lliihq.x1plvlek span',
    ],
    description: [
      'h1._ap3a._aaco._aacu._aacx._aad7._aade',
      'span._ap3a._aaco._aacu._aacx._aad7._aade',
      '[data-testid="post-content"]',
    ],
    likeCount: [
      'section span[class*="html-span"]',
      'button[type="button"] span',
    ],
    viewCount: [
      'span[class*="x1lliihq"]',
    ],
    images: [
      'article img[srcset]',
      'article img[src*="cdninstagram"]',
      'div[role="button"] img',
    ],
  },
};

export class InstagramScraper extends BaseScraper {
  constructor() {
    super(INSTAGRAM_CONFIG);
  }

  getPlatform(): Platform {
    return 'INSTAGRAM_REELS';
  }

  protected extractFromJson(): Omit<ProductData, 'platform'> | null {
    // Method 1: Try _sharedData (older Instagram)
    const scripts = document.querySelectorAll('script');

    for (const script of scripts) {
      const content = script.textContent || '';

      // _sharedData pattern
      const sharedMatch = content.match(/window\._sharedData\s*=\s*({[\s\S]*?});/);
      if (sharedMatch) {
        try {
          const data = JSON.parse(sharedMatch[1]);
          const result = this.parseSharedData(data);
          if (result) return result;
        } catch {
          continue;
        }
      }

      // __additionalDataLoaded pattern
      const additionalMatch = content.match(/window\.__additionalDataLoaded\s*\(\s*['"][^'"]+['"]\s*,\s*({[\s\S]*?})\s*\)/);
      if (additionalMatch) {
        try {
          const data = JSON.parse(additionalMatch[1]);
          const result = this.parseGraphQLData(data);
          if (result) return result;
        } catch {
          continue;
        }
      }
    }

    // Method 2: Check for data in link preload
    // Note: These are API responses that would need async fetch - skip for now
    // const preloadScripts = document.querySelectorAll('link[rel="preload"][as="fetch"]');

    return null;
  }

  private parseSharedData(data: Record<string, unknown>): Omit<ProductData, 'platform'> | null {
    try {
      // Navigate through _sharedData structure
      const entryData = data.entry_data as Record<string, unknown>;
      if (!entryData) return null;

      // For posts/reels
      const postPage = (entryData.PostPage as unknown[]) || (entryData.ReelPage as unknown[]);
      if (postPage && postPage[0]) {
        const post = postPage[0] as Record<string, unknown>;
        const graphql = post.graphql as Record<string, unknown>;
        const media = (graphql?.shortcode_media || post.shortcode_media) as Record<string, unknown>;

        if (media) {
          return this.extractFromMedia(media);
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  private parseGraphQLData(data: Record<string, unknown>): Omit<ProductData, 'platform'> | null {
    try {
      const graphql = data.graphql as Record<string, unknown> | undefined;
      const media = (graphql?.shortcode_media || data.shortcode_media) as Record<string, unknown>;
      if (media) {
        return this.extractFromMedia(media);
      }
    } catch {
      return null;
    }
    return null;
  }

  private extractFromMedia(media: Record<string, unknown>): Omit<ProductData, 'platform'> | null {
    // Get caption/title
    const captionEdges = (media.edge_media_to_caption as { edges?: Array<{ node: { text: string } }> })?.edges;
    const caption = captionEdges?.[0]?.node?.text || '';

    // If no caption, try to get from accessibility caption
    const title = caption || (media.accessibility_caption as string) || 'Instagram Reel';

    // Get owner info
    const owner = media.owner as Record<string, unknown>;
    const username = owner?.username as string;
    const fullName = owner?.full_name as string;

    // Get engagement stats
    const likeCount = (media.edge_media_preview_like as { count?: number })?.count;
    const viewCount = media.video_view_count as number;

    // Get images
    const images: string[] = [];
    const displayUrl = media.display_url as string;
    if (displayUrl) images.push(displayUrl);

    const thumbnailSrc = media.thumbnail_src as string;
    if (thumbnailSrc && thumbnailSrc !== displayUrl) {
      images.push(thumbnailSrc);
    }

    // Extract affiliate links from caption
    const affiliateLinks = this.extractAffiliateLinks(caption);

    // Get hashtags
    const hashtags = this.extractHashtags(caption);

    // Build video metadata
    const videoMetadata: VideoMetadata = {
      videoId: media.shortcode as string,
      viewCount: viewCount?.toString(),
      likeCount: likeCount?.toString(),
      creator: fullName || username,
      creatorHandle: username,
      hashtags,
    };

    return {
      url: window.location.href,
      title: this.truncateTitle(title),
      description: caption,
      price: '',
      images,
      shopName: username,
      videoMetadata,
      affiliateLinks: affiliateLinks.length > 0 ? affiliateLinks : undefined,
      reviews: [],
    };
  }

  protected extractFromDom(): Omit<ProductData, 'platform'> | null {
    // Instagram's DOM is heavily obfuscated with random class names
    // We need to use a combination of aria labels, data attributes, and structure

    // Try to get caption/title
    let title = '';

    // Method 1: Look for caption in article
    const articleText = document.querySelector('article')?.textContent || '';

    // Method 2: Try meta tags
    if (!title) {
      const ogTitle = this.getMetaContent('og:title');
      if (ogTitle) {
        title = ogTitle;
      }
    }

    // Method 3: Try description meta
    if (!title) {
      const description = this.getMetaContent('og:description') || this.getMetaContent('description');
      if (description) {
        title = description;
      }
    }

    if (!title) {
      title = 'Instagram Reel';
    }

    // Get username from URL or page
    let username = '';
    const urlMatch = window.location.pathname.match(/^\/([^/]+)\//);
    if (urlMatch && !['reel', 'reels', 'p', 'stories'].includes(urlMatch[1])) {
      username = urlMatch[1];
    }

    // Try to find username in the page
    if (!username) {
      const usernameEl = document.querySelector('header a[href^="/"]');
      if (usernameEl) {
        const href = usernameEl.getAttribute('href');
        const match = href?.match(/^\/([^/]+)/);
        if (match) username = match[1];
      }
    }

    // Get images
    const images = this.getInstagramImages();

    // Get hashtags from title/caption
    const hashtags = this.extractHashtags(title);

    // Extract affiliate links
    const affiliateLinks = this.extractAffiliateLinks(title + ' ' + articleText);

    // Build video metadata
    const videoMetadata: VideoMetadata = {
      videoId: this.extractReelId(),
      creator: username,
      creatorHandle: username,
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

  private extractReelId(): string {
    const url = window.location.href;

    // Reel URL: instagram.com/reel/{reelId}
    const reelMatch = url.match(/\/reel\/([^/?]+)/);
    if (reelMatch) return reelMatch[1];

    // Post URL: instagram.com/p/{postId}
    const postMatch = url.match(/\/p\/([^/?]+)/);
    if (postMatch) return postMatch[1];

    return '';
  }

  private getInstagramImages(): string[] {
    const images: string[] = [];
    const seen = new Set<string>();

    // Try to get from og:image first (most reliable)
    const ogImage = this.getMetaContent('og:image');
    if (ogImage && !seen.has(ogImage)) {
      seen.add(ogImage);
      images.push(ogImage);
    }

    // Try article images
    const articleImages = document.querySelectorAll('article img[src*="cdninstagram"]');
    articleImages.forEach((el) => {
      const img = el as HTMLImageElement;
      const src = img.src;
      if (src && !seen.has(src) && !src.includes('150x150')) {
        seen.add(src);
        images.push(src);
      }
    });

    // Try video poster
    const video = document.querySelector('video');
    if (video) {
      const poster = video.poster;
      if (poster && !seen.has(poster)) {
        seen.add(poster);
        images.push(poster);
      }
    }

    return images.slice(0, 5);
  }

  private extractAffiliateLinks(text: string): AffiliateLink[] {
    const links: AffiliateLink[] = [];
    const seen = new Set<string>();

    // Common affiliate and shopping link patterns
    const patterns = [
      { pattern: /https?:\/\/(?:www\.)?amazon\.[a-z.]+\/[^\s)"\]]+/gi, label: 'Amazon' },
      { pattern: /https?:\/\/(?:www\.)?shopmy\.us\/[^\s)"\]]+/gi, label: 'ShopMy' },
      { pattern: /https?:\/\/(?:www\.)?linktr\.ee\/[^\s)"\]]+/gi, label: 'Linktree' },
      { pattern: /https?:\/\/(?:www\.)?bit\.ly\/[^\s)"\]]+/gi, label: 'Link' },
      { pattern: /https?:\/\/(?:www\.)?liketoknow\.it\/[^\s)"\]]+/gi, label: 'LIKEtoKNOW.it' },
      { pattern: /https?:\/\/(?:www\.)?stan\.store\/[^\s)"\]]+/gi, label: 'Stan Store' },
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
    // Instagram captions can be very long, truncate for display
    const maxLength = 200;
    if (title.length <= maxLength) return title;

    // Try to cut at a sentence or word boundary
    const truncated = title.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength - 50) {
      return truncated.slice(0, lastSpace) + '...';
    }
    return truncated + '...';
  }
}

export const instagramScraper = new InstagramScraper();
