import type { ProductData, Platform } from '@aiugcify/shared-types';

export interface ScraperConfig {
  platform: Platform;
  urlPatterns: RegExp[];
  jsonPatterns?: RegExp[];
  selectors: Record<string, string[]>;
}

export abstract class BaseScraper {
  protected config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  abstract getPlatform(): Platform;

  matchesUrl(url: string): boolean {
    return this.config.urlPatterns.some((pattern) => pattern.test(url));
  }

  async scrape(): Promise<ProductData | null> {
    // Try JSON extraction first (preferred - more reliable)
    const jsonData = this.extractFromJson();
    if (jsonData) {
      return { ...jsonData, platform: this.getPlatform() };
    }

    // Fallback to DOM scraping
    const domData = this.extractFromDom();
    if (domData) {
      return { ...domData, platform: this.getPlatform() };
    }

    return null;
  }

  // Subclasses must override these
  protected abstract extractFromJson(): Omit<ProductData, 'platform'> | null;
  protected abstract extractFromDom(): Omit<ProductData, 'platform'> | null;

  // Utility method to wait for product data with polling and mutation observer
  async waitForProductData(timeout: number): Promise<ProductData | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkData = async () => {
        const data = await this.scrape();
        if (data) {
          resolve(data);
          return;
        }

        if (Date.now() - startTime >= timeout) {
          resolve(null);
          return;
        }

        setTimeout(checkData, 500);
      };

      // Also listen for DOM changes
      const observer = new MutationObserver(async () => {
        const data = await this.scrape();
        if (data) {
          observer.disconnect();
          resolve(data);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Start checking
      checkData();

      // Cleanup after timeout
      setTimeout(() => {
        observer.disconnect();
      }, timeout);
    });
  }

  // ============ Shared Utility Methods ============

  protected getTextFromSelectors(selectors: string[]): string | undefined {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element?.textContent?.trim()) {
          return element.textContent.trim();
        }
      } catch {
        continue;
      }
    }
    return undefined;
  }

  protected getImagesFromSelectors(selectors: string[]): string[] {
    const images: string[] = [];
    const seen = new Set<string>();

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const img = el as HTMLImageElement;
          const src = img.src || img.dataset.src || img.getAttribute('data-src');

          if (src && !seen.has(src) && !src.includes('data:image')) {
            seen.add(src);
            images.push(src);
          }
        });

        if (images.length > 0) break;
      } catch {
        continue;
      }
    }

    return images.slice(0, 10); // Limit to 10 images
  }

  protected parsePrice(priceStr: string | undefined): string {
    if (!priceStr) return '';
    // Extract numeric value and format as price
    const match = priceStr.match(/[\$\u00A3\u20AC]?[\d,.]+/);
    if (match) {
      const cleaned = match[0];
      // Add $ if no currency symbol present
      if (!cleaned.match(/[\$\u00A3\u20AC]/)) {
        return `$${cleaned}`;
      }
      return cleaned;
    }
    return priceStr;
  }

  protected parsePriceValue(priceStr: string): number | null {
    if (!priceStr) return null;
    // Extract numeric value from price string (handles $10.99, 10.99, etc.)
    const match = priceStr.replace(/[,$]/g, '').match(/[\d.]+/);
    if (match) {
      return parseFloat(match[0]);
    }
    return null;
  }

  protected calculateDiscount(currentPrice: string, originalPrice: string): string | undefined {
    const current = this.parsePriceValue(currentPrice);
    const original = this.parsePriceValue(originalPrice);

    if (current && original && original > current) {
      const discountPercent = Math.round(((original - current) / original) * 100);
      if (discountPercent > 0 && discountPercent < 100) {
        return `${discountPercent}% off`;
      }
    }
    return undefined;
  }

  protected parseRating(text: string | undefined | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/[\d.]+/);
    if (match) {
      const rating = parseFloat(match[0]);
      // Normalize to 5-star scale if needed
      if (rating > 5 && rating <= 10) {
        return rating / 2;
      }
      return rating;
    }
    return undefined;
  }

  protected formatPrice(price: unknown): string {
    if (!price) return '';

    if (typeof price === 'string') {
      // If already has currency symbol, return as-is
      if (price.includes('$')) return price;
      // Try to parse as number
      const num = parseFloat(price.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) {
        // If it looks like cents (large number with no decimal), divide by 100
        if (num > 1000 && !price.includes('.')) {
          return `$${(num / 100).toFixed(2)}`;
        }
        return `$${num.toFixed(2)}`;
      }
      return price;
    }

    if (typeof price === 'number') {
      // If price looks like cents (large number), divide by 100
      if (price > 10000) {
        return `$${(price / 100).toFixed(2)}`;
      }
      return `$${price.toFixed(2)}`;
    }

    return String(price);
  }

  protected isElementStrikethrough(element: Element): boolean {
    // Check tag name
    if (element.tagName === 'DEL' || element.tagName === 'S') {
      return true;
    }

    // Check class names
    const className = element.className?.toLowerCase() || '';
    if (
      className.includes('line-through') ||
      className.includes('linethrough') ||
      className.includes('strikethrough') ||
      className.includes('strike-through') ||
      className.includes('original') ||
      className.includes('compare') ||
      className.includes('was-price') ||
      className.includes('before')
    ) {
      return true;
    }

    // Check computed style
    try {
      const style = window.getComputedStyle(element);
      if (style.textDecoration.includes('line-through') || style.textDecorationLine.includes('line-through')) {
        return true;
      }
    } catch {
      // Ignore style check errors
    }

    return false;
  }

  protected stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  protected extractHashtags(text: string): string[] {
    const matches = text.match(/#[\w]+/g) || [];
    return matches.map((h) => h.slice(1));
  }

  protected getMetaContent(property: string): string | null {
    const meta = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
    return meta?.getAttribute('content') || null;
  }
}
