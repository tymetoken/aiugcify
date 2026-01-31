import { getScraperForUrl, detectPlatform, isSupported } from './scrapers';
import type { ProductData, Platform } from '@aiugcify/shared-types';

let cachedProductData: ProductData | null = null;
let currentPlatform: Platform | null = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_PRODUCT_DATA') {
    if (cachedProductData) {
      sendResponse({ success: true, data: cachedProductData, platform: currentPlatform });
    } else {
      sendResponse({ success: false, error: 'No product data cached' });
    }
    return true;
  }

  if (request.type === 'GET_PLATFORM') {
    sendResponse({ platform: currentPlatform });
    return true;
  }

  if (request.type === 'SCRAPE_PRODUCT') {
    scrapeProduct()
      .then((data) => {
        sendResponse({ success: true, data, platform: currentPlatform });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  return false;
});

async function scrapeProduct(): Promise<ProductData> {
  const url = window.location.href;
  const scraper = getScraperForUrl(url);

  if (!scraper) {
    throw new Error('No scraper available for this page');
  }

  currentPlatform = scraper.getPlatform();

  try {
    // Try immediate scrape
    let data = await scraper.scrape();

    if (!data) {
      // Wait for dynamic content
      data = await scraper.waitForProductData(10000);
    }

    if (!data) {
      throw new Error('Could not extract product data');
    }

    cachedProductData = data;
    return data;
  } catch (error) {
    console.error(`[AI UGCify] Failed to scrape ${currentPlatform} product:`, error);
    throw error;
  }
}

// Auto-scrape on page load
async function init() {
  const url = window.location.href;

  // Check if we're on a supported page
  if (!isSupported(url)) {
    return;
  }

  // Detect platform
  currentPlatform = detectPlatform(url);

  // Wait for page to fully load
  if (document.readyState !== 'complete') {
    await new Promise((resolve) => {
      window.addEventListener('load', resolve, { once: true });
    });
  }

  // Small delay to ensure dynamic content is loaded
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    await scrapeProduct();
    console.log(`[AI UGCify] ${currentPlatform} product data scraped successfully`);

    // Notify background script
    chrome.runtime.sendMessage({
      type: 'PRODUCT_SCRAPED',
      data: cachedProductData,
      platform: currentPlatform,
    });
  } catch (error) {
    console.log(`[AI UGCify] Failed to auto-scrape ${currentPlatform} product:`, error);
  }
}

// Watch for SPA navigation
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    const previousUrl = lastUrl;
    lastUrl = window.location.href;
    cachedProductData = null;

    // Detect new platform
    const newPlatform = detectPlatform(lastUrl);

    if (newPlatform) {
      currentPlatform = newPlatform;

      // Notify popup that we've navigated to a new product page
      chrome.runtime.sendMessage({
        type: 'PRODUCT_PAGE_CHANGED',
        previousUrl,
        newUrl: lastUrl,
        platform: currentPlatform,
      });
      setTimeout(init, 1000);
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// Initialize
init();
