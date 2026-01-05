import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeStorageAdapter } from '@/shared/chrome-storage';

type Page =
  | 'login'
  | 'register'
  | 'welcome'
  | 'dashboard'
  | 'product'
  | 'script-editor'
  | 'generating'
  | 'video-ready'
  | 'credits'
  | 'history';

interface UIState {
  currentPage: Page;
  _hasHydrated: boolean;
  setPage: (page: Page) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      currentPage: 'dashboard',
      _hasHydrated: false,
      setPage: (page) => set({ currentPage: page }),
      setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        currentPage: state.currentPage,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
