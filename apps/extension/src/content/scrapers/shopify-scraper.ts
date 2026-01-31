import type { ProductData, Platform, ProductVariant } from '@aiugcify/shared-types';
import { BaseScraper, ScraperConfig } from './base-scraper';

interface ShopifyWindow extends Window {
  Shopify?: {
    shop?: string;
    theme?: { name: string };
    currency?: { active: string };
  };
  ShopifyAnalytics?: {
    meta?: {
      product?: ShopifyProductMeta;
    };
  };
}

interface ShopifyProductMeta {
  id: number;
  gid: string;
  vendor: string;
  type: string;
  variants: Array<{ id: number; name: string; price: number }>;
}

interface ShopifyProduct {
  id?: number;
  title?: string;
  handle?: string;
  description?: string;
  vendor?: string;
  type?: string;
  price?: number;
  price_min?: number;
  price_max?: number;
  compare_at_price?: number;
  compare_at_price_min?: number;
  compare_at_price_max?: number;
  images?: Array<string | { src: string }>;
  featured_image?: string;
  variants?: Array<{
    id: number;
    title: string;
    price: string | number;
    compare_at_price?: string | number | null;
    available: boolean;
    option1?: string;
    option2?: string;
    option3?: string;
    featured_image?: { src: string } | null;
  }>;
  options?: string[];
}

const SHOPIFY_CONFIG: ScraperConfig = {
  platform: 'SHOPIFY',
  urlPatterns: [
    /\/products\//,
  ],
  selectors: {
    title: [
      '.product-single__title',
      '.product__title',
      'h1.title',
      '[data-product-title]',
      '.product-title',
      '.ProductMeta__Title',
      'h1[itemprop="name"]',
      '.product-info h1',
      '.product__heading',
    ],
    price: [
      '.product-single__price',
      '.product__price',
      '[data-product-price]',
      '.price--regular',
      '.ProductMeta__Price',
      '.product-price',
      '[data-price]',
      '.price .money',
      '.current-price',
    ],
    originalPrice: [
      '.product-single__price--compare',
      '.price--compare',
      '[data-compare-price]',
      '.ProductMeta__Price--compare',
      '.compare-price',
      '.was-price',
      '.price--was .money',
      '[data-compare-at-price]',
    ],
    description: [
      '.product-single__description',
      '.product__description',
      '[data-product-description]',
      '.ProductMeta__Description',
      '.product-description',
      '[itemprop="description"]',
      '.product__content',
    ],
    images: [
      '.product-single__photo img',
      '.product__photo img',
      '[data-product-featured-image]',
      '.product-gallery img',
      '.ProductGallery img',
      '.product__media img',
      '.product-images img',
      '[data-zoom-image]',
    ],
    shopName: [
      '.product-single__vendor',
      '[data-product-vendor]',
      '.product-vendor',
      '.ProductMeta__Vendor',
      '[itemprop="brand"]',
    ],
  },
};

export class ShopifyScraper extends BaseScraper {
  constructor() {
    super(SHOPIFY_CONFIG);
  }

  getPlatform(): Platform {
    return 'SHOPIFY';
  }

  // Override matchesUrl to also check for Shopify object
  matchesUrl(url: string): boolean {
    if (!super.matchesUrl(url)) return false;

    // Verify this is actually a Shopify store
    const win = window as ShopifyWindow;
    return typeof win.Shopify !== 'undefined' || this.hasShopifySignature();
  }

  private hasShopifySignature(): boolean {
    // Check for common Shopify signatures in the DOM
    return (
      !!document.querySelector('link[href*="cdn.shopify.com"]') ||
      !!document.querySelector('script[src*="cdn.shopify.com"]') ||
      !!document.querySelector('[data-shopify]') ||
      !!document.querySelector('meta[name="shopify-checkout-api-token"]')
    );
  }

  protected extractFromJson(): Omit<ProductData, 'platform'> | null {
    // Method 1: Product JSON in script tag
    const productJsonScript = document.querySelector(
      'script[type="application/json"][data-product-json], ' +
        'script[type="application/json"][id*="product"], ' +
        'script[data-section-type="product"] script[type="application/json"]'
    );

    if (productJsonScript) {
      try {
        const product = JSON.parse(productJsonScript.textContent || '') as ShopifyProduct;
        const result = this.parseShopifyProduct(product);
        if (result) return result;
      } catch {
        // Continue to other methods
      }
    }

    // Method 2: Look for product JSON in inline scripts
    const scripts = document.querySelectorAll('script:not([src])');
    for (const script of scripts) {
      const content = script.textContent || '';

      // Pattern 1: var product = {...}
      const productMatch = content.match(/var\s+(?:product|currentProduct)\s*=\s*(\{[\s\S]*?\});/);
      if (productMatch) {
        try {
          const product = JSON.parse(productMatch[1]) as ShopifyProduct;
          const result = this.parseShopifyProduct(product);
          if (result) return result;
        } catch {
          continue;
        }
      }

      // Pattern 2: ShopifyAnalytics.meta.product
      const metaMatch = content.match(/ShopifyAnalytics\.meta\.product\s*=\s*(\{[\s\S]*?\});/);
      if (metaMatch) {
        try {
          const meta = JSON.parse(metaMatch[1]);
          // This is limited data, continue to DOM extraction
          if (meta.id) {
            // We have some data but need more from DOM
            continue;
          }
        } catch {
          continue;
        }
      }
    }

    // Method 3: Fetch from /products/{handle}.json (sync approach via DOM data)
    // Note: We avoid async fetch here, but check if data is available in meta tags
    const productUrl = window.location.pathname;
    const handleMatch = productUrl.match(/\/products\/([^/?#]+)/);
    if (handleMatch) {
      // Check if there's embedded product data in the page
      const ldJson = document.querySelector('script[type="application/ld+json"]');
      if (ldJson) {
        try {
          const data = JSON.parse(ldJson.textContent || '');
          if (data['@type'] === 'Product') {
            return this.parseLdJsonProduct(data);
          }
        } catch {
          // Continue to DOM extraction
        }
      }
    }

    return null;
  }

  private parseShopifyProduct(product: ShopifyProduct): Omit<ProductData, 'platform'> | null {
    if (!product.title) return null;

    // Price handling - Shopify stores prices in cents
    const price = this.formatShopifyPrice(product.price || product.price_min);
    const originalPrice = this.formatShopifyPrice(
      product.compare_at_price || product.compare_at_price_min
    );

    // Calculate discount
    let discount: string | undefined;
    if (price && originalPrice) {
      discount = this.calculateDiscount(price, originalPrice);
    }

    // Extract images
    const images: string[] = [];
    if (product.images) {
      for (const img of product.images) {
        const src = typeof img === 'string' ? img : img.src;
        if (src) {
          // Ensure we get a reasonably sized image
          images.push(this.ensureImageSize(src));
        }
      }
    }
    if (product.featured_image && images.length === 0) {
      images.push(this.ensureImageSize(product.featured_image));
    }

    // Extract variants
    const variants: ProductVariant[] = (product.variants || []).map((v) => ({
      id: String(v.id),
      title: v.title,
      price: this.formatShopifyPrice(v.price),
      available: v.available,
      options: {
        ...(v.option1 && { option1: v.option1 }),
        ...(v.option2 && { option2: v.option2 }),
        ...(v.option3 && { option3: v.option3 }),
      },
    }));

    return {
      url: window.location.href,
      title: product.title,
      description: product.description ? this.stripHtml(product.description) : '',
      price,
      originalPrice: originalPrice || undefined,
      discount,
      images,
      shopName: product.vendor,
      variants: variants.length > 0 ? variants : undefined,
      reviews: [],
    };
  }

  private parseLdJsonProduct(data: Record<string, unknown>): Omit<ProductData, 'platform'> | null {
    const name = data.name as string;
    if (!name) return null;

    const offers = data.offers as Record<string, unknown> | Array<Record<string, unknown>>;
    let price = '';
    let originalPrice: string | undefined;

    if (offers) {
      const offer = Array.isArray(offers) ? offers[0] : offers;
      if (offer) {
        price = offer.price ? `$${offer.price}` : '';
        // LD+JSON doesn't usually have compare price
      }
    }

    const images: string[] = [];
    const imageData = data.image;
    if (typeof imageData === 'string') {
      images.push(imageData);
    } else if (Array.isArray(imageData)) {
      images.push(...imageData.filter((i): i is string => typeof i === 'string'));
    }

    return {
      url: window.location.href,
      title: name,
      description: (data.description as string) || '',
      price,
      originalPrice,
      images,
      shopName: (data.brand as Record<string, unknown>)?.name as string,
      reviews: [],
    };
  }

  private formatShopifyPrice(price: unknown): string {
    if (!price) return '';

    if (typeof price === 'string') {
      // Already formatted
      if (price.includes('$')) return price;
      // Try to parse
      const num = parseFloat(price);
      if (!isNaN(num)) {
        // Check if it's in cents (typical Shopify format)
        if (num > 100 && !price.includes('.')) {
          return `$${(num / 100).toFixed(2)}`;
        }
        return `$${num.toFixed(2)}`;
      }
      return price;
    }

    if (typeof price === 'number') {
      // Shopify typically stores prices in cents
      if (price > 100) {
        return `$${(price / 100).toFixed(2)}`;
      }
      return `$${price.toFixed(2)}`;
    }

    return '';
  }

  private ensureImageSize(url: string): string {
    // Shopify image URLs can have size suffixes like _100x100
    // Replace with larger size or remove for original
    return url
      .replace(/_\d+x\d+\./, '_1024x1024.')
      .replace(/_small\./, '_large.')
      .replace(/_medium\./, '_large.')
      .replace(/_compact\./, '_large.');
  }

  protected extractFromDom(): Omit<ProductData, 'platform'> | null {
    const title = this.getTextFromSelectors(this.config.selectors.title);
    if (!title) return null;

    // Get prices
    let price = this.getTextFromSelectors(this.config.selectors.price) || '';
    let originalPrice = this.getTextFromSelectors(this.config.selectors.originalPrice);

    // Clean up prices
    price = this.cleanPrice(price);
    if (originalPrice) {
      originalPrice = this.cleanPrice(originalPrice);
    }

    // If same, clear original
    if (price && originalPrice && price === originalPrice) {
      originalPrice = undefined;
    }

    // Calculate discount
    let discount: string | undefined;
    if (price && originalPrice) {
      discount = this.calculateDiscount(price, originalPrice);
    }

    // Get images
    const images = this.getShopifyImages();

    // Get description
    const description = this.getTextFromSelectors(this.config.selectors.description) || '';

    // Get vendor/brand
    const shopName = this.getTextFromSelectors(this.config.selectors.shopName);

    return {
      url: window.location.href,
      title,
      description,
      price,
      originalPrice,
      discount,
      images,
      shopName,
      reviews: [],
    };
  }

  private cleanPrice(price: string): string {
    // Remove "From" prefix common in Shopify stores with variants
    price = price.replace(/^from\s*/i, '').trim();

    // Extract the actual price value
    const match = price.match(/[\$\u00A3\u20AC]?[\d,.]+/);
    if (match) {
      let cleaned = match[0];
      // Add $ if no currency symbol
      if (!cleaned.match(/[\$\u00A3\u20AC]/)) {
        cleaned = `$${cleaned}`;
      }
      return cleaned;
    }
    return price;
  }

  private getShopifyImages(): string[] {
    const images: string[] = [];
    const seen = new Set<string>();

    // Try specific selectors first
    for (const selector of this.config.selectors.images) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const img = el as HTMLImageElement;
          let src =
            img.src ||
            img.dataset.src ||
            img.dataset.zoom ||
            img.getAttribute('data-zoom-image') ||
            img.getAttribute('data-image');

          if (src && !seen.has(src) && !src.includes('data:image')) {
            // Ensure good resolution
            src = this.ensureImageSize(src);
            seen.add(src);
            images.push(src);
          }
        });

        if (images.length > 0) break;
      } catch {
        continue;
      }
    }

    // Fallback to og:image
    if (images.length === 0) {
      const ogImage = this.getMetaContent('og:image');
      if (ogImage) {
        images.push(this.ensureImageSize(ogImage));
      }
    }

    return images.slice(0, 10);
  }
}

export const shopifyScraper = new ShopifyScraper();
