import type { ProductData, Platform, ProductReview } from '@aiugcify/shared-types';
import { BaseScraper, ScraperConfig } from './base-scraper';

const TIKTOK_CONFIG: ScraperConfig = {
  platform: 'TIKTOK_SHOP',
  urlPatterns: [
    /tiktok\.com.*\/product\//,
    /tiktok\.com.*\/shop\/pdp\//,
    /shop\.tiktok\.com/,
  ],
  jsonPatterns: [
    /__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.*});/s,
    /window\.__INITIAL_STATE__\s*=\s*({.*});/s,
    /window\.__NEXT_DATA__\s*=\s*({.*});/s,
    /window\.__DATA__\s*=\s*({.*});/s,
    /"product"\s*:\s*({[^}]+})/s,
  ],
  selectors: {
    title: [
      '[data-e2e="product-title"]',
      '[class*="ProductTitle"]',
      '[class*="pdp-title"]',
      '[class*="product-title"]',
      '[class*="Title"] h1',
      'h1[class*="title"]',
      'h1[class*="Title"]',
      '[class*="main-title"]',
      'h1',
    ],
    price: [
      '[data-e2e="product-price"]',
      '[data-e2e="pdp-price"]',
      '[data-e2e="price-current"]',
      '[class*="SalePrice"]:not([class*="Original"]):not(del):not(s)',
      '[class*="sale-price"]:not([class*="original"]):not(del):not(s)',
      '[class*="CurrentPrice"]',
      '[class*="current-price"]',
      '[class*="FinalPrice"]',
      '[class*="final-price"]',
      '[class*="DiscountPrice"]',
      '[class*="discount-price"]',
      '[class*="ProductPrice"]:not([class*="Original"]):not(del):not(s)',
      '[class*="pdp-price"]:not([class*="original"]):not(del):not(s)',
      '[class*="PriceContainer"] [class*="Price"]:first-child',
      '[class*="priceContainer"] [class*="price"]:first-child',
      '[class*="Price"]:not([class*="Original"]):not([class*="Compare"]):not([class*="LineThrough"]):not(del):not(s) span:first-child',
    ],
    originalPrice: [
      '[data-e2e="original-price"]',
      '[class*="OriginalPrice"]',
      '[class*="original-price"]',
      '[class*="LineThrough"]',
      '[class*="line-through"]',
      '[class*="ComparePrice"]',
      '[class*="compare-price"]',
      '[class*="was-price"]',
      '[class*="crossed"]',
      '[class*="BeforePrice"]',
      '[class*="before-price"]',
      's[class*="price"]',
      'del[class*="price"]',
      'del',
      's',
    ],
    discount: [
      '[data-e2e="discount"]',
      '[data-e2e="discount-tag"]',
      '[data-e2e="pdp-discount"]',
      '[data-e2e="price-discount"]',
      '[class*="DiscountTag"]',
      '[class*="discount-tag"]',
      '[class*="DiscountBadge"]',
      '[class*="discount-badge"]',
      '[class*="Discount"]:not([class*="Price"])',
      '[class*="discount"]:not([class*="price"])',
      '[class*="SaleTag"]',
      '[class*="sale-tag"]',
      '[class*="SaveTag"]',
      '[class*="save-tag"]',
      '[class*="off-tag"]',
      '[class*="OffTag"]',
      '[class*="percent-off"]',
      '[class*="PercentOff"]',
    ],
    description: [
      '[data-e2e="product-description"]',
      '[class*="ProductDescription"]',
      '[class*="pdp-description"]',
      '[class*="description"]',
      '.product-description',
    ],
    mainProductImage: [
      '[data-e2e="pdp-image-container"] img',
      '[data-e2e="product-image"] img:first-child',
      '[class*="ImageGallery"] [class*="MainImage"] img',
      '[class*="pdp-main-image"] img',
      '[class*="ProductMainImage"] img',
      '[class*="product-detail"] [class*="image-gallery"] img:first-child',
      '[class*="DetailImage"] img:first-child',
      '[class*="Swiper"][class*="product"] img:first-child',
      '[class*="swiper-slide-active"] img',
      '[class*="carousel"][class*="product"] img:first-child',
    ],
    images: [
      '[data-e2e="product-image"] img',
      '[class*="ProductImage"] img',
      '[class*="pdp-image"] img',
      '[class*="MainImage"] img',
      '[class*="main-image"] img',
      '[class*="Swiper"] img',
      '[class*="swiper"] img',
      '.product-image img',
      '[class*="carousel"] img',
      '[class*="gallery"] img',
      'img[class*="product"]',
      'img[src*="tiktokcdn"]',
    ],
    rating: [
      '[data-e2e="product-rating"]',
      '[class*="ProductRating"]',
      '[class*="pdp-rating"]',
      '[class*="Rating"]',
      '[class*="rating"]',
    ],
    soldCount: [
      '[data-e2e="sold-count"]',
      '[class*="SoldCount"]',
      '[class*="sold-count"]',
      '[class*="Sold"]',
      '[class*="sold"]',
    ],
    shopName: [
      '[data-e2e="shop-name"]',
      '[class*="ShopName"]',
      '[class*="shop-name"]',
      '[class*="Seller"]',
      '[class*="seller"]',
      '[class*="Store"]',
      '[class*="store"]',
    ],
    reviews: [
      '[data-e2e="review-item"]',
      '[class*="ReviewItem"]',
      '[class*="review-item"]',
    ],
  },
};

export class TikTokScraper extends BaseScraper {
  constructor() {
    super(TIKTOK_CONFIG);
  }

  getPlatform(): Platform {
    return 'TIKTOK_SHOP';
  }

  protected extractFromJson(): Omit<ProductData, 'platform'> | null {
    const scripts = document.querySelectorAll('script');
    const patterns = this.config.jsonPatterns || [];

    for (const script of scripts) {
      const content = script.textContent || '';

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            const productData = this.parseProductFromJson(data);
            if (productData && productData.title) {
              return productData;
            }
          } catch {
            continue;
          }
        }
      }
    }

    // Also check for JSON in type="application/json" scripts
    const jsonScripts = document.querySelectorAll('script[type="application/json"]');
    for (const script of jsonScripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        const productData = this.parseProductFromJson(data);
        if (productData && productData.title) {
          return productData;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private parseProductFromJson(data: unknown): Omit<ProductData, 'platform'> | null {
    if (!data || typeof data !== 'object') return null;

    const productKeys = ['product', 'productInfo', 'item', 'itemInfo', 'goods', 'pdpData', 'productDetail', 'itemDetail', 'data'];
    const obj = data as Record<string, unknown>;

    for (const key of productKeys) {
      if (obj[key] && typeof obj[key] === 'object') {
        const product = obj[key] as Record<string, unknown>;
        const title =
          (product.title as string) ||
          (product.name as string) ||
          (product.productName as string);

        if (title) {
          const currentPrice = this.formatPrice(product.price || product.salePrice);
          const originalPrice = this.formatPrice(product.originalPrice || product.marketPrice);
          let discount = (product.discount as string) || (product.discountRate as string) || '';

          if (!discount && currentPrice && originalPrice) {
            discount = this.calculateDiscount(currentPrice, originalPrice) || '';
          }

          return {
            url: window.location.href,
            title,
            description: (product.description as string) || '',
            price: currentPrice,
            originalPrice: originalPrice || undefined,
            discount: discount || undefined,
            images: this.extractImagesFromJson(product),
            rating: parseFloat(String(product.rating || product.avgRating || 0)),
            soldCount: String(product.soldCount || product.sales || ''),
            shopName: String(product.shopName || product.sellerName || ''),
            reviews: [],
          };
        }
      }
    }

    // Deep search
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        const result = this.parseProductFromJson(value);
        if (result) return result;
      }
    }

    return null;
  }

  private extractImagesFromJson(product: Record<string, unknown>): string[] {
    const imageKeys = ['images', 'imageUrls', 'photos', 'gallery', 'mainImage'];

    for (const key of imageKeys) {
      const value = product[key];
      if (Array.isArray(value)) {
        return value
          .map((img) => (typeof img === 'string' ? img : (img as { url?: string })?.url))
          .filter(Boolean) as string[];
      }
      if (typeof value === 'string') {
        return [value];
      }
    }

    return [];
  }

  protected extractFromDom(): Omit<ProductData, 'platform'> | null {
    let title = this.getTextFromSelectors(this.config.selectors.title);

    // Fallback: try to get title from page title
    if (!title) {
      const pageTitle = document.title;
      if (pageTitle && pageTitle.includes('TikTok')) {
        title = pageTitle.replace(/\s*\|.*TikTok.*$/i, '').replace(/\s*-\s*TikTok.*$/i, '').trim();
      }
    }

    // Fallback: try to get from meta tags
    if (!title) {
      title = this.getMetaContent('og:title') || undefined;
    }

    if (!title) return null;

    // Get the main product image first
    const mainImage = this.getMainProductImage();

    // Get additional images
    let images = this.getProductImages();
    if (images.length === 0) {
      const ogImage = this.getMetaContent('og:image');
      if (ogImage && !this.isReviewImageUrl(ogImage)) {
        images = [ogImage];
      }
    }

    // Ensure main product image is first
    if (mainImage) {
      images = [mainImage, ...images.filter((img) => img !== mainImage)];
    }

    // Get prices
    const { salePrice, originalPrice: origPrice } = this.extractPrices();

    let price = salePrice || this.getTextFromSelectors(this.config.selectors.price) || '';
    let originalPrice = origPrice || this.getTextFromSelectors(this.config.selectors.originalPrice);

    // Fallback: Look for any element with $ sign
    if (!price) {
      const priceMatch = document.body.innerText.match(/\$[\d,.]+/);
      if (priceMatch) {
        price = priceMatch[0];
      }
    }

    // If same price for both, clear original
    if (price && originalPrice && price === originalPrice) {
      originalPrice = undefined;
    }

    // If original price is lower than sale price, swap them
    if (price && originalPrice) {
      const priceVal = this.parsePriceValue(price);
      const origVal = this.parsePriceValue(originalPrice);
      if (priceVal && origVal && priceVal > origVal) {
        const temp = price;
        price = originalPrice;
        originalPrice = temp;
      }
    }

    // Get discount
    let discount = this.extractDiscount();

    if (!discount && price && originalPrice) {
      discount = this.calculateDiscount(price, originalPrice);
    }

    return {
      url: window.location.href,
      title,
      description: this.getTextFromSelectors(this.config.selectors.description) || '',
      price,
      originalPrice,
      discount,
      images,
      rating: this.parseRating(this.getTextFromSelectors(this.config.selectors.rating)),
      soldCount: this.getTextFromSelectors(this.config.selectors.soldCount),
      shopName: this.getTextFromSelectors(this.config.selectors.shopName),
      reviews: this.getReviewsFromDom(),
    };
  }

  private extractPrices(): { salePrice: string | undefined; originalPrice: string | undefined } {
    const priceElements: Array<{ element: Element; text: string; isStrikethrough: boolean; fontSize: number }> = [];

    const allElements = document.querySelectorAll('[class*="price"], [class*="Price"], [data-e2e*="price"], span, del, s');

    for (const el of allElements) {
      const text = el.textContent?.trim() || '';
      const priceMatch = text.match(/^\$[\d,.]+(?:\s*-\s*\$[\d,.]+)?$/);
      if (priceMatch) {
        const isStrikethrough = this.isElementStrikethrough(el);
        let fontSize = 14;
        try {
          const style = window.getComputedStyle(el);
          fontSize = parseFloat(style.fontSize) || 14;
        } catch {
          // Ignore
        }
        priceElements.push({ element: el, text: priceMatch[0], isStrikethrough, fontSize });
      }
    }

    // Remove duplicates
    const uniquePrices = priceElements.filter((p, i, arr) =>
      arr.findIndex((x) => x.text === p.text && x.isStrikethrough === p.isStrikethrough) === i
    );

    let salePrice: string | undefined;
    let originalPrice: string | undefined;

    const strikethroughPrices = uniquePrices.filter((p) => p.isStrikethrough);
    const normalPrices = uniquePrices.filter((p) => !p.isStrikethrough);

    if (strikethroughPrices.length > 0) {
      originalPrice = strikethroughPrices.reduce((max, p) => {
        const maxVal = this.parsePriceValue(max.text) || 0;
        const pVal = this.parsePriceValue(p.text) || 0;
        return pVal > maxVal ? p : max;
      }).text;
    }

    if (normalPrices.length > 0) {
      if (originalPrice) {
        const origVal = this.parsePriceValue(originalPrice) || 0;
        const lowerPrices = normalPrices.filter((p) => {
          const val = this.parsePriceValue(p.text) || 0;
          return val < origVal;
        });
        if (lowerPrices.length > 0) {
          salePrice = lowerPrices.reduce((max, p) => (p.fontSize > max.fontSize ? p : max)).text;
        } else {
          salePrice = normalPrices.reduce((max, p) => (p.fontSize > max.fontSize ? p : max)).text;
        }
      } else {
        salePrice = normalPrices.reduce((max, p) => (p.fontSize > max.fontSize ? p : max)).text;
      }
    }

    // Handle price ranges
    if (salePrice && salePrice.includes('-')) {
      salePrice = salePrice.split('-')[0].trim();
    }
    if (originalPrice && originalPrice.includes('-')) {
      originalPrice = originalPrice.split('-').pop()?.trim();
    }

    return { salePrice, originalPrice };
  }

  private extractDiscount(): string | undefined {
    const selectorDiscount = this.getTextFromSelectors(this.config.selectors.discount);
    if (selectorDiscount) {
      const normalized = this.normalizeDiscount(selectorDiscount);
      if (normalized) return normalized;
    }

    const discountPatterns = [
      /(-?\d+%)\s*off/i,
      /save\s*(-?\d+%)/i,
      /(-\d+%)/,
      /(\d+%)\s*off/i,
      /(\d+)\s*%\s*off/i,
    ];

    const candidates = document.querySelectorAll(
      '[class*="price"], [class*="Price"], [class*="discount"], [class*="Discount"], ' +
        '[class*="save"], [class*="Save"], [class*="tag"], [class*="Tag"], [class*="badge"], [class*="Badge"], span'
    );

    for (const el of candidates) {
      const text = el.textContent?.trim() || '';
      if (text.includes('$') && !text.includes('%')) continue;
      if (text.length > 20) continue;

      for (const pattern of discountPatterns) {
        const match = text.match(pattern);
        if (match) {
          const normalized = this.normalizeDiscount(match[1] || match[0]);
          if (normalized) return normalized;
        }
      }
    }

    return undefined;
  }

  private normalizeDiscount(text: string): string | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)/);
    if (match) {
      const percent = parseInt(match[1], 10);
      if (percent > 0 && percent < 100) {
        return `${percent}% off`;
      }
    }
    return undefined;
  }

  private isInReviewSection(element: Element): boolean {
    let parent: Element | null = element;
    while (parent) {
      const className = parent.className?.toLowerCase() || '';
      const dataE2e = parent.getAttribute('data-e2e')?.toLowerCase() || '';

      if (
        className.includes('review') ||
        className.includes('comment') ||
        className.includes('feedback') ||
        className.includes('rating-item') ||
        className.includes('user-content') ||
        dataE2e.includes('review') ||
        dataE2e.includes('comment')
      ) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  private isReviewImageUrl(url: string): boolean {
    const lowercaseUrl = url.toLowerCase();
    return (
      lowercaseUrl.includes('review') ||
      lowercaseUrl.includes('comment') ||
      lowercaseUrl.includes('user-upload') ||
      lowercaseUrl.includes('ugc') ||
      lowercaseUrl.includes('100x100') ||
      lowercaseUrl.includes('50x50')
    );
  }

  private getMainProductImage(): string | undefined {
    for (const selector of this.config.selectors.mainProductImage) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const img = el as HTMLImageElement;
          const src = img.src || img.dataset.src || img.getAttribute('data-src');

          if (src && !src.includes('data:image') && !this.isInReviewSection(img) && !this.isReviewImageUrl(src)) {
            if (img.naturalWidth > 200 || !img.complete) {
              return src;
            }
          }
        }
      } catch {
        continue;
      }
    }

    const ogImage = this.getMetaContent('og:image');
    if (ogImage && !this.isReviewImageUrl(ogImage)) {
      return ogImage;
    }

    return undefined;
  }

  private getProductImages(): string[] {
    const images: string[] = [];
    const seen = new Set<string>();

    for (const selector of this.config.selectors.images) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const img = el as HTMLImageElement;
          const src = img.src || img.dataset.src || img.getAttribute('data-src');

          if (
            src &&
            !seen.has(src) &&
            !src.includes('data:image') &&
            !this.isInReviewSection(img) &&
            !this.isReviewImageUrl(src)
          ) {
            seen.add(src);
            images.push(src);
          }
        });

        if (images.length > 0) break;
      } catch {
        continue;
      }
    }

    return images.slice(0, 10);
  }

  private getReviewsFromDom(): ProductReview[] {
    const reviews: ProductReview[] = [];

    for (const selector of this.config.selectors.reviews) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const text = el.querySelector('[class*="text"]')?.textContent?.trim();
          const ratingEl = el.querySelector('[class*="rating"], [class*="star"]');
          const authorEl = el.querySelector('[class*="author"], [class*="name"]');

          if (text) {
            reviews.push({
              rating: this.parseRating(ratingEl?.textContent) || 5,
              text,
              author: authorEl?.textContent?.trim(),
            });
          }
        });

        if (reviews.length > 0) break;
      } catch {
        continue;
      }
    }

    return reviews.slice(0, 10);
  }
}

export const tiktokScraper = new TikTokScraper();
