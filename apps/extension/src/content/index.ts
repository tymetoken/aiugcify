import { scrapeProductData, waitForProductData } from './tiktok-scraper';
import type { ProductData } from '@aiugcify/shared-types';

let cachedProductData: ProductData | null = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_PRODUCT_DATA') {
    if (cachedProductData) {
      sendResponse({ success: true, data: cachedProductData });
    } else {
      sendResponse({ success: false, error: 'No product data cached' });
    }
    return true;
  }

  if (request.type === 'SCRAPE_PRODUCT') {
    scrapeProduct()
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  return false;
});

async function scrapeProduct(): Promise<ProductData> {
  try {
    // Try immediate scrape
    let data = scrapeProductData();

    if (!data) {
      // Wait for dynamic content
      data = await waitForProductData(10000);
    }

    if (!data) {
      throw new Error('Could not extract product data');
    }

    cachedProductData = data;
    return data;
  } catch (error) {
    console.error('Failed to scrape product:', error);
    throw error;
  }
}

// Auto-scrape on page load
async function init() {
  // Check if we're on a product page
  if (!isProductPage()) {
    return;
  }

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
    console.log('[AI UGCify] Product data scraped successfully');

    // Notify background script
    chrome.runtime.sendMessage({
      type: 'PRODUCT_SCRAPED',
      data: cachedProductData,
    });
  } catch (error) {
    console.log('[AI UGCify] Failed to auto-scrape product:', error);
  }
}

function isProductPage(): boolean {
  const url = window.location.href;
  return (
    url.includes('tiktok.com') &&
    (url.includes('/product/') || url.includes('/shop/pdp/') || url.includes('shop.tiktok.com'))
  );
}

// Watch for SPA navigation
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    const previousUrl = lastUrl;
    lastUrl = window.location.href;
    cachedProductData = null;

    if (isProductPage()) {
      // Notify popup that we've navigated to a new product page
      chrome.runtime.sendMessage({
        type: 'PRODUCT_PAGE_CHANGED',
        previousUrl,
        newUrl: lastUrl,
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
