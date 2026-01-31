import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeStorageAdapter } from '@/shared/chrome-storage';
import type { ProductData, Platform } from '@aiugcify/shared-types';

// Helper to detect platform from URL
function detectPlatformFromUrl(url: string): Platform | null {
  // TikTok Shop
  if (url.includes('tiktok.com') && (url.includes('/product/') || url.includes('/shop/') || url.includes('shop.tiktok.com'))) {
    return 'TIKTOK_SHOP';
  }
  // YouTube Shorts
  if (url.includes('youtube.com/shorts/') || (url.includes('youtube.com/watch') && url.includes('shorts'))) {
    return 'YOUTUBE_SHORTS';
  }
  // YouTube (regular videos can also have products)
  if (url.includes('youtube.com/watch')) {
    return 'YOUTUBE_SHORTS';
  }
  // Facebook Reels
  if (url.includes('facebook.com/reel/') || url.includes('facebook.com/watch/') || url.includes('fb.watch/') || url.match(/facebook\.com\/.*\/videos\//)) {
    return 'FACEBOOK_REELS';
  }
  // Instagram Reels
  if (url.includes('instagram.com/reel/') || url.includes('instagram.com/reels/') || url.includes('instagram.com/p/')) {
    return 'INSTAGRAM_REELS';
  }
  // Amazon
  if (url.match(/amazon\.[a-z.]+\/(dp|gp\/product)\//)) {
    return 'AMAZON';
  }
  // Shopify (generic product pages - will be validated by content script)
  if (url.includes('/products/') || url.includes('.myshopify.com')) {
    return 'SHOPIFY';
  }
  return null;
}

interface ProductState {
  scrapedProduct: ProductData | null;
  detectedPlatform: Platform | null;
  isOnProductPage: boolean;
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  setScrapedProduct: (product: ProductData | null) => void;
  setDetectedPlatform: (platform: Platform | null) => void;
  setIsOnProductPage: (isOn: boolean) => void;
  checkCurrentTab: () => Promise<void>;
  scrapeCurrentPage: () => Promise<void>;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useProductStore = create<ProductState>()(
  persist(
    (set) => ({
      scrapedProduct: null,
      detectedPlatform: null,
      isOnProductPage: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      setScrapedProduct: (product) => set({ scrapedProduct: product }),

      setDetectedPlatform: (platform) => set({ detectedPlatform: platform }),

      setIsOnProductPage: (isOn) => set({ isOnProductPage: isOn }),

      setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),

      checkCurrentTab: async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

          if (!tab?.url) {
            set({ isOnProductPage: false, detectedPlatform: null });
            // Don't clear scrapedProduct - preserve it for workflow
            return;
          }

          // Detect platform from URL
          const platform = detectPlatformFromUrl(tab.url);
          const isOnProductPage = platform !== null;

          set({ isOnProductPage, detectedPlatform: platform });

          if (isOnProductPage && tab.id) {
            // Request product data from content script
            try {
              const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PRODUCT_DATA' });
              if (response?.success && response.data) {
                // Include platform from response if available, otherwise use detected
                const productWithPlatform = {
                  ...response.data,
                  platform: response.platform || platform,
                };
                set({ scrapedProduct: productWithPlatform, detectedPlatform: response.platform || platform });
              }
              // Don't clear scrapedProduct on failure - preserve existing data
            } catch {
              // Content script might not be loaded yet - don't clear existing data
            }
          }
        } catch (error) {
          console.error('Failed to check current tab:', error);
        }
      },

      scrapeCurrentPage: async () => {
        set({ isLoading: true, error: null });

        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

          if (!tab?.id || !tab?.url) {
            throw new Error('No active tab found');
          }

          const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PRODUCT' });

          if (response?.success && response.data) {
            // Include platform from response if available, otherwise detect from URL
            const platform = response.platform || detectPlatformFromUrl(tab.url);
            const productWithPlatform = {
              ...response.data,
              platform,
            };
            set({ scrapedProduct: productWithPlatform, detectedPlatform: platform, isLoading: false });
          } else {
            throw new Error(response?.error || 'Failed to scrape product');
          }
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'product-storage',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        scrapedProduct: state.scrapedProduct,
        detectedPlatform: state.detectedPlatform,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
