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
  showKeyboardShortcuts: boolean;
  setPage: (page: Page) => void;
  setHasHydrated: (value: boolean) => void;
  setShowKeyboardShortcuts: (show: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      currentPage: 'dashboard',
      _hasHydrated: false,
      showKeyboardShortcuts: false,
      setPage: (page) => set({ currentPage: page }),
      setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),
      setShowKeyboardShortcuts: (show) => set({ showKeyboardShortcuts: show }),
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
