import type { ProductData, ProductReview } from '@aiugcify/shared-types';

// Selectors for TikTok Shop product pages
const SELECTORS = {
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
  // Sale/current price - prioritize sale price selectors
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
  // Main product images - prioritize the primary product gallery, NOT reviews
  mainProductImage: [
    // TikTok Shop main product image selectors (most specific first)
    '[data-e2e="pdp-image-container"] img',
    '[data-e2e="product-image"] img:first-child',
    '[class*="ImageGallery"] [class*="MainImage"] img',
    '[class*="pdp-main-image"] img',
    '[class*="ProductMainImage"] img',
    '[class*="product-detail"] [class*="image-gallery"] img:first-child',
    '[class*="DetailImage"] img:first-child',
    // Swiper/carousel main slide (first image only)
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
};

export function scrapeProductData(): ProductData | null {
  // First try to extract from embedded JSON
  const jsonData = extractFromJson();
  if (jsonData) {
    return jsonData;
  }

  // Fallback to DOM scraping
  return extractFromDom();
}

function extractFromJson(): ProductData | null {
  const scripts = document.querySelectorAll('script');

  const patterns = [
    /__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.*});/s,
    /window\.__INITIAL_STATE__\s*=\s*({.*});/s,
    /window\.__NEXT_DATA__\s*=\s*({.*});/s,
    /window\.__DATA__\s*=\s*({.*});/s,
    /"product"\s*:\s*({[^}]+})/s,
  ];

  for (const script of scripts) {
    const content = script.textContent || '';

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const productData = parseProductFromJson(data);
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
      const productData = parseProductFromJson(data);
      if (productData && productData.title) {
        return productData;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parseProductFromJson(data: unknown): ProductData | null {
  if (!data || typeof data !== 'object') return null;

  // Recursive search for product data
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
        const currentPrice = formatPrice(product.price || product.salePrice);
        const originalPrice = formatPrice(product.originalPrice || product.marketPrice);
        let discount = (product.discount as string) || (product.discountRate as string) || '';

        // Calculate discount if not provided but prices are available
        if (!discount && currentPrice && originalPrice) {
          discount = calculateDiscount(currentPrice, originalPrice) || '';
        }

        return {
          url: window.location.href,
          title,
          description: (product.description as string) || '',
          price: currentPrice,
          originalPrice: originalPrice || undefined,
          discount: discount || undefined,
          images: extractImages(product),
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
      const result = parseProductFromJson(value);
      if (result) return result;
    }
  }

  return null;
}

function extractFromDom(): ProductData | null {
  let title = getTextFromSelectors(SELECTORS.title);

  // Fallback: try to get title from page title
  if (!title) {
    const pageTitle = document.title;
    if (pageTitle && pageTitle.includes('TikTok')) {
      // Remove "| TikTok" suffix and similar
      title = pageTitle.replace(/\s*\|.*TikTok.*$/i, '').replace(/\s*-\s*TikTok.*$/i, '').trim();
    }
  }

  // Fallback: try to get from meta tags
  if (!title) {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      title = ogTitle.getAttribute('content') || undefined;
    }
  }

  if (!title) return null;

  // Get the main product image first (prioritize over other images)
  const mainImage = getMainProductImage();

  // Get additional images with fallback to og:image
  let images = getImagesFromSelectors(SELECTORS.images);
  if (images.length === 0) {
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
      const imgUrl = ogImage.getAttribute('content');
      if (imgUrl && !isReviewImageUrl(imgUrl)) images = [imgUrl];
    }
  }

  // Ensure main product image is first in the array
  if (mainImage) {
    images = [mainImage, ...images.filter((img) => img !== mainImage)];
  }

  // Get prices - need to be smart about sale vs original price
  const { salePrice, originalPrice: origPrice } = extractPrices();

  let price = salePrice || getTextFromSelectors(SELECTORS.price) || '';
  let originalPrice = origPrice || getTextFromSelectors(SELECTORS.originalPrice);

  // Fallback: Look for any element with $ sign
  if (!price) {
    const priceMatch = document.body.innerText.match(/\$[\d,.]+/);
    if (priceMatch) {
      price = priceMatch[0];
    }
  }

  // If we got the same price for both, the original price selector might have picked up the wrong one
  if (price && originalPrice && price === originalPrice) {
    originalPrice = undefined;
  }

  // If original price is lower than sale price, they're swapped
  if (price && originalPrice) {
    const priceVal = parsePriceValue(price);
    const origVal = parsePriceValue(originalPrice);
    if (priceVal && origVal && priceVal > origVal) {
      // Swap them - sale price should be lower
      const temp = price;
      price = originalPrice;
      originalPrice = temp;
    }
  }

  // Get discount from page - try multiple methods
  let discount = extractDiscount();

  // If no discount found from page but we have both prices, calculate it
  if (!discount && price && originalPrice) {
    discount = calculateDiscount(price, originalPrice);
  }

  // Validate discount - if we found one on page, verify it roughly matches calculated
  if (discount && price && originalPrice) {
    const calculatedDiscount = calculateDiscount(price, originalPrice);
    if (calculatedDiscount) {
      const pagePercent = parseDiscountPercent(discount);
      const calcPercent = parseDiscountPercent(calculatedDiscount);
      // If they differ by more than 2%, prefer the page's displayed discount
      // (as it's what the user sees) but log for debugging
      if (pagePercent && calcPercent && Math.abs(pagePercent - calcPercent) > 2) {
        console.log(`[AI UGCify] Discount mismatch: page shows ${pagePercent}%, calculated ${calcPercent}%`);
      }
    }
  }

  return {
    url: window.location.href,
    title,
    description: getTextFromSelectors(SELECTORS.description) || '',
    price,
    originalPrice,
    discount,
    images,
    rating: parseRating(getTextFromSelectors(SELECTORS.rating)),
    soldCount: getTextFromSelectors(SELECTORS.soldCount),
    shopName: getTextFromSelectors(SELECTORS.shopName),
    reviews: getReviewsFromDom(),
  };
}

function getTextFromSelectors(selectors: string[]): string | undefined {
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

// Smart discount extraction - looks for percentage patterns on the page
function extractDiscount(): string | undefined {
  // First try the specific discount selectors
  const selectorDiscount = getTextFromSelectors(SELECTORS.discount);
  if (selectorDiscount) {
    const normalized = normalizeDiscount(selectorDiscount);
    if (normalized) return normalized;
  }

  // Look for elements containing discount patterns near price elements
  const discountPatterns = [
    /(-?\d+%)\s*off/i,
    /save\s*(-?\d+%)/i,
    /(-\d+%)/,
    /(\d+%)\s*off/i,
    /(\d+)\s*%\s*off/i,
  ];

  // Search in elements that might contain discounts
  const candidates = document.querySelectorAll(
    '[class*="price"], [class*="Price"], [class*="discount"], [class*="Discount"], ' +
    '[class*="save"], [class*="Save"], [class*="tag"], [class*="Tag"], [class*="badge"], [class*="Badge"], span'
  );

  for (const el of candidates) {
    const text = el.textContent?.trim() || '';
    // Skip if it's a price element (contains $)
    if (text.includes('$') && !text.includes('%')) continue;
    // Skip if too long (likely not a discount badge)
    if (text.length > 20) continue;

    for (const pattern of discountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const normalized = normalizeDiscount(match[1] || match[0]);
        if (normalized) return normalized;
      }
    }
  }

  return undefined;
}

// Normalize discount text to consistent format
function normalizeDiscount(text: string): string | undefined {
  if (!text) return undefined;

  // Extract the percentage number
  const match = text.match(/(\d+)/);
  if (match) {
    const percent = parseInt(match[1], 10);
    if (percent > 0 && percent < 100) {
      return `-${percent}%`;
    }
  }
  return undefined;
}

// Parse discount string to get the percentage number
function parseDiscountPercent(discount: string): number | null {
  if (!discount) return null;
  const match = discount.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// Smart price extraction - finds all price elements and determines which is sale vs original
function extractPrices(): { salePrice: string | undefined; originalPrice: string | undefined } {
  // Find all elements that look like prices
  const priceElements: Array<{ element: Element; text: string; isStrikethrough: boolean; fontSize: number }> = [];

  // Look for elements containing price patterns
  const allElements = document.querySelectorAll('[class*="price"], [class*="Price"], [data-e2e*="price"], span, del, s');

  for (const el of allElements) {
    const text = el.textContent?.trim() || '';
    // Check if it contains a price pattern (allow price ranges like $10.99 - $15.99)
    const priceMatch = text.match(/^\$[\d,.]+(?:\s*-\s*\$[\d,.]+)?$/);
    if (priceMatch) {
      const isStrikethrough = isElementStrikethrough(el);
      // Get font size to help determine which is the main price (larger = more prominent)
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

  // Remove duplicates (same text and strikethrough status)
  const uniquePrices = priceElements.filter((p, i, arr) =>
    arr.findIndex(x => x.text === p.text && x.isStrikethrough === p.isStrikethrough) === i
  );

  // Find sale price (not strikethrough) and original price (strikethrough)
  let salePrice: string | undefined;
  let originalPrice: string | undefined;

  // First, look for strikethrough prices as original
  const strikethroughPrices = uniquePrices.filter(p => p.isStrikethrough);
  const normalPrices = uniquePrices.filter(p => !p.isStrikethrough);

  if (strikethroughPrices.length > 0) {
    // The highest strikethrough price is likely the original
    originalPrice = strikethroughPrices.reduce((max, p) => {
      const maxVal = parsePriceValue(max.text) || 0;
      const pVal = parsePriceValue(p.text) || 0;
      return pVal > maxVal ? p : max;
    }).text;
  }

  if (normalPrices.length > 0) {
    // If we have an original price, the sale price should be lower
    if (originalPrice) {
      const origVal = parsePriceValue(originalPrice) || 0;
      const lowerPrices = normalPrices.filter(p => {
        const val = parsePriceValue(p.text) || 0;
        return val < origVal;
      });
      if (lowerPrices.length > 0) {
        // Prefer the price with the largest font size (most prominent on page)
        salePrice = lowerPrices.reduce((max, p) => {
          return p.fontSize > max.fontSize ? p : max;
        }).text;
      } else {
        // All normal prices are >= original, pick the one with largest font
        salePrice = normalPrices.reduce((max, p) => {
          return p.fontSize > max.fontSize ? p : max;
        }).text;
      }
    } else {
      // No original price found, get the most prominent (largest font) normal price
      salePrice = normalPrices.reduce((max, p) => {
        return p.fontSize > max.fontSize ? p : max;
      }).text;
    }
  }

  // Handle price ranges - extract the first (lowest) price
  if (salePrice && salePrice.includes('-')) {
    const firstPrice = salePrice.split('-')[0].trim();
    salePrice = firstPrice;
  }
  if (originalPrice && originalPrice.includes('-')) {
    const lastPrice = originalPrice.split('-').pop()?.trim();
    if (lastPrice) originalPrice = lastPrice;
  }

  return { salePrice, originalPrice };
}

// Check if an element has strikethrough styling
function isElementStrikethrough(element: Element): boolean {
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

  // Check parent elements for strikethrough
  let parent = element.parentElement;
  let depth = 0;
  while (parent && depth < 3) {
    if (parent.tagName === 'DEL' || parent.tagName === 'S') {
      return true;
    }
    const parentClass = parent.className?.toLowerCase() || '';
    if (
      parentClass.includes('line-through') ||
      parentClass.includes('original') ||
      parentClass.includes('compare')
    ) {
      return true;
    }
    parent = parent.parentElement;
    depth++;
  }

  return false;
}

// Check if an image element is inside a review section (should be excluded from main product images)
function isInReviewSection(element: Element): boolean {
  let parent: Element | null = element;
  while (parent) {
    const className = parent.className?.toLowerCase() || '';
    const dataE2e = parent.getAttribute('data-e2e')?.toLowerCase() || '';

    // Check for review-related class names or data attributes
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

// Check if image URL looks like a user-uploaded review image
function isReviewImageUrl(url: string): boolean {
  const lowercaseUrl = url.toLowerCase();
  return (
    lowercaseUrl.includes('review') ||
    lowercaseUrl.includes('comment') ||
    lowercaseUrl.includes('user-upload') ||
    lowercaseUrl.includes('ugc') ||
    // Small thumbnails are often review images
    (lowercaseUrl.includes('100x100') || lowercaseUrl.includes('50x50'))
  );
}

// Get the main product image specifically (not review images)
function getMainProductImage(): string | undefined {
  // First, try the specific main product image selectors
  for (const selector of SELECTORS.mainProductImage) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const img = el as HTMLImageElement;
        const src = img.src || img.dataset.src || img.getAttribute('data-src');

        if (src && !src.includes('data:image') && !isInReviewSection(img) && !isReviewImageUrl(src)) {
          // Prefer larger images (main product images are usually high resolution)
          if (img.naturalWidth > 200 || !img.complete) {
            return src;
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Fallback: try og:image meta tag (usually the main product image)
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const imgUrl = ogImage.getAttribute('content');
    if (imgUrl && !isReviewImageUrl(imgUrl)) {
      return imgUrl;
    }
  }

  return undefined;
}

function getImagesFromSelectors(selectors: string[]): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const img = el as HTMLImageElement;
        const src = img.src || img.dataset.src || img.getAttribute('data-src');

        // Skip review images and data URIs
        if (src && !seen.has(src) && !src.includes('data:image') && !isInReviewSection(img) && !isReviewImageUrl(src)) {
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

function getReviewsFromDom(): ProductReview[] {
  const reviews: ProductReview[] = [];

  for (const selector of SELECTORS.reviews) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const text = el.querySelector('[class*="text"]')?.textContent?.trim();
        const ratingEl = el.querySelector('[class*="rating"], [class*="star"]');
        const authorEl = el.querySelector('[class*="author"], [class*="name"]');

        if (text) {
          reviews.push({
            rating: parseRating(ratingEl?.textContent) || 5,
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

  return reviews.slice(0, 10); // Limit to 10 reviews
}

function formatPrice(price: unknown): string {
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
    // Most product prices are under $10000, so if > 10000 it's likely in cents
    if (price > 10000) {
      return `$${(price / 100).toFixed(2)}`;
    }
    // If it's a reasonable price already (e.g., 45.00), use as-is
    if (price < 10000) {
      return `$${price.toFixed(2)}`;
    }
    return `$${(price / 100).toFixed(2)}`;
  }

  return String(price);
}

function calculateDiscount(currentPrice: string, originalPrice: string): string | undefined {
  const current = parsePriceValue(currentPrice);
  const original = parsePriceValue(originalPrice);

  if (current && original && original > current) {
    const discountPercent = Math.round(((original - current) / original) * 100);
    if (discountPercent > 0 && discountPercent < 100) {
      return `${discountPercent}% off`;
    }
  }
  return undefined;
}

function parsePriceValue(priceStr: string): number | null {
  if (!priceStr) return null;
  // Extract numeric value from price string (handles $10.99, 10.99, etc.)
  const match = priceStr.replace(/[,$]/g, '').match(/[\d.]+/);
  if (match) {
    return parseFloat(match[0]);
  }
  return null;
}

function extractImages(product: Record<string, unknown>): string[] {
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

function parseRating(text: string | undefined | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/[\d.]+/);
  if (match) {
    return parseFloat(match[0]);
  }
  return undefined;
}

export function waitForProductData(timeout: number): Promise<ProductData | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkData = () => {
      const data = scrapeProductData();
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
    const observer = new MutationObserver(() => {
      const data = scrapeProductData();
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
