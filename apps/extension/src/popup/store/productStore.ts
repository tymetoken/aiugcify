import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeStorageAdapter } from '@/shared/chrome-storage';
import type { ProductData } from '@aiugcify/shared-types';

interface ProductState {
  scrapedProduct: ProductData | null;
  isOnProductPage: boolean;
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  setScrapedProduct: (product: ProductData | null) => void;
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
      isOnProductPage: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      setScrapedProduct: (product) => set({ scrapedProduct: product }),

      setIsOnProductPage: (isOn) => set({ isOnProductPage: isOn }),

      setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),

      checkCurrentTab: async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

          if (!tab?.url) {
            set({ isOnProductPage: false });
            // Don't clear scrapedProduct - preserve it for workflow
            return;
          }

          const isTikTokShop =
            tab.url.includes('tiktok.com') &&
            (tab.url.includes('/product/') || tab.url.includes('/shop/pdp/') || tab.url.includes('shop.tiktok.com'));

          set({ isOnProductPage: isTikTokShop });

          if (isTikTokShop && tab.id) {
            // Request product data from content script
            try {
              const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PRODUCT_DATA' });
              if (response?.success && response.data) {
                set({ scrapedProduct: response.data });
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

          if (!tab?.id) {
            throw new Error('No active tab found');
          }

          const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PRODUCT' });

          if (response?.success && response.data) {
            set({ scrapedProduct: response.data, isLoading: false });
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
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
