import type { ProductData, Platform } from '@aiugcify/shared-types';
import { BaseScraper, ScraperConfig } from './base-scraper';

const AMAZON_CONFIG: ScraperConfig = {
  platform: 'AMAZON',
  urlPatterns: [
    /amazon\.[a-z.]+\/dp\//,
    /amazon\.[a-z.]+\/gp\/product\//,
    /amazon\.[a-z.]+\/.*\/dp\//,
  ],
  selectors: {
    title: [
      '#productTitle',
      '#title span',
      'h1#title',
      'h1[data-automation-id="title"]',
      '#btAsinTitle',
    ],
    price: [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#corePrice_feature_div .a-offscreen',
      '.apexPriceToPay .a-offscreen',
      '#price_inside_buybox',
      '.a-price-whole',
      '#newBuyBoxPrice',
    ],
    originalPrice: [
      '.a-text-price .a-offscreen',
      '#priceblock_listprice',
      '.basisPrice .a-offscreen',
      '.a-text-strike .a-offscreen',
      '#listPrice',
      '.a-price[data-a-strike="true"] .a-offscreen',
    ],
    description: [
      '#productDescription p',
      '#productDescription',
      '#feature-bullets',
      '#aplus-content',
    ],
    bulletPoints: [
      '#feature-bullets ul li:not(.aok-hidden) span.a-list-item',
      '#feature-bullets li span',
    ],
    rating: [
      '#acrPopover',
      '.a-icon-alt',
      '#averageCustomerReviews .a-icon-alt',
    ],
    reviewCount: [
      '#acrCustomerReviewText',
      '#acrCustomerReviewLink span',
    ],
    images: [
      '#landingImage',
      '#imgTagWrapperId img',
      '.a-dynamic-image',
      '#imageBlock img',
      '#main-image-container img',
    ],
    shopName: [
      '#bylineInfo',
      '#sellerProfileTriggerId',
      '#brand',
      '.po-brand .a-span9 span',
    ],
  },
};

export class AmazonScraper extends BaseScraper {
  constructor() {
    super(AMAZON_CONFIG);
  }

  getPlatform(): Platform {
    return 'AMAZON';
  }

  protected extractFromJson(): Omit<ProductData, 'platform'> | null {
    // Amazon embeds product data in various script tags
    const scripts = document.querySelectorAll('script[type="text/javascript"], script:not([type])');

    for (const script of scripts) {
      const content = script.textContent || '';

      // Try to find product data in various Amazon JSON patterns
      const patterns = [
        /var obj = jQuery\.parseJSON\('(.+?)'\)/s,
        /'colorImages'\s*:\s*(\{.+?\})\s*,/s,
        /"colorImages"\s*:\s*(\{.+?\})\s*,/s,
        /P\.register\('twister-state',\s*(\{.+?\})\)/s,
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            // Check if this contains useful product data
            if (data.colorImages || data.initial) {
              // This is typically image data, not full product data
              // Continue to DOM extraction
              continue;
            }
          } catch {
            continue;
          }
        }
      }
    }

    // Amazon's product data is mostly in the DOM, not JSON
    return null;
  }

  protected extractFromDom(): Omit<ProductData, 'platform'> | null {
    const title = this.getTextFromSelectors(this.config.selectors.title);
    if (!title) return null;

    // Get prices
    let price = this.getTextFromSelectors(this.config.selectors.price);
    let originalPrice = this.getTextFromSelectors(this.config.selectors.originalPrice);

    // Clean up prices
    if (price) {
      price = this.cleanAmazonPrice(price);
    }
    if (originalPrice) {
      originalPrice = this.cleanAmazonPrice(originalPrice);
    }

    // If same price, clear original
    if (price && originalPrice && price === originalPrice) {
      originalPrice = undefined;
    }

    // Calculate discount
    let discount: string | undefined;
    if (price && originalPrice) {
      discount = this.calculateDiscount(price, originalPrice);
    }

    // Extract bullet points (key features)
    const bulletPoints = this.extractBulletPoints();

    // Get description - combine multiple sources
    let description = this.getTextFromSelectors(this.config.selectors.description) || '';
    if (bulletPoints.length > 0 && !description) {
      description = bulletPoints.join('. ');
    }

    // Extract images
    const images = this.extractAmazonImages();

    // Get rating
    const ratingText = this.getTextFromSelectors(this.config.selectors.rating);
    const rating = this.parseRating(ratingText);

    // Get review count
    const reviewCountText = this.getTextFromSelectors(this.config.selectors.reviewCount);
    const soldCount = reviewCountText ? reviewCountText.replace(/[^\d,]/g, '') + ' reviews' : undefined;

    // Get seller/brand
    let shopName = this.getTextFromSelectors(this.config.selectors.shopName);
    if (shopName) {
      // Clean up "Visit the X Store" or "Brand: X"
      shopName = shopName.replace(/^(Visit the |Brand:\s*)/i, '').replace(/\s*Store$/i, '').trim();
    }

    return {
      url: window.location.href,
      title: title.trim(),
      description,
      price: price || '',
      originalPrice,
      discount,
      images,
      rating,
      soldCount,
      shopName,
      bulletPoints,
      reviews: [],
    };
  }

  private cleanAmazonPrice(price: string): string {
    // Amazon prices can have range format like "$10.99 - $15.99"
    // Extract first price for sale price
    const priceMatch = price.match(/\$[\d,.]+/);
    return priceMatch ? priceMatch[0] : price;
  }

  private extractBulletPoints(): string[] {
    const bulletPoints: string[] = [];
    const selectors = this.config.selectors.bulletPoints;

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const text = el.textContent?.trim();
          if (text && text.length > 5 && text.length < 500) {
            // Filter out boilerplate text
            if (
              !text.toLowerCase().includes('click here') &&
              !text.toLowerCase().includes('see more') &&
              !text.toLowerCase().includes('product description')
            ) {
              bulletPoints.push(text);
            }
          }
        });
        if (bulletPoints.length > 0) break;
      } catch {
        continue;
      }
    }

    return bulletPoints.slice(0, 10);
  }

  private extractAmazonImages(): string[] {
    const images: string[] = [];
    const seen = new Set<string>();

    // Method 1: Get high-res images from data attributes
    const mainImage = document.querySelector('#landingImage, #imgTagWrapperId img') as HTMLImageElement;
    if (mainImage) {
      // Try to get high-res version from data attributes
      const hiRes = mainImage.getAttribute('data-old-hires');
      const dynamicImage = mainImage.getAttribute('data-a-dynamic-image');

      if (hiRes && !seen.has(hiRes)) {
        seen.add(hiRes);
        images.push(hiRes);
      } else if (dynamicImage) {
        try {
          const parsed = JSON.parse(dynamicImage) as Record<string, number[]>;
          // Get URLs sorted by resolution (higher first)
          const urls = Object.keys(parsed).sort((a, b) => {
            const aRes = (parsed[b]?.[0] || 0) * (parsed[b]?.[1] || 0);
            const bRes = (parsed[a]?.[0] || 0) * (parsed[a]?.[1] || 0);
            return aRes - bRes;
          });
          for (const url of urls.slice(0, 5)) {
            if (!seen.has(url)) {
              seen.add(url);
              images.push(url);
            }
          }
        } catch {
          // Use src instead
          if (mainImage.src && !seen.has(mainImage.src)) {
            seen.add(mainImage.src);
            images.push(mainImage.src);
          }
        }
      } else if (mainImage.src && !seen.has(mainImage.src)) {
        seen.add(mainImage.src);
        images.push(mainImage.src);
      }
    }

    // Method 2: Get thumbnail gallery images and convert to high-res
    const thumbs = document.querySelectorAll('.imageThumbnail img, #altImages img, .a-button-thumbnail img');
    thumbs.forEach((thumb) => {
      const img = thumb as HTMLImageElement;
      let src = img.src;

      // Convert thumbnail URL to high-res
      // Amazon thumbnails often have ._SX40_. or ._AC_US40_. - remove these
      if (src) {
        src = src.replace(/\._[A-Z]{2}_[A-Z0-9_]+_\./, '.');
        if (!seen.has(src)) {
          seen.add(src);
          images.push(src);
        }
      }
    });

    // Method 3: Fallback to og:image
    if (images.length === 0) {
      const ogImage = this.getMetaContent('og:image');
      if (ogImage) {
        images.push(ogImage);
      }
    }

    return images.slice(0, 10);
  }
}

export const amazonScraper = new AmazonScraper();
