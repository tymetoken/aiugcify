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
        // Don't persist login/register pages - they should be transient
        // If user was on login/register, default to dashboard on next load
        currentPage: state.currentPage === 'login' || state.currentPage === 'register'
          ? 'dashboard'
          : state.currentPage,
      }),
      onRehydrateStorage: () => (state) => {
        // If somehow login/register was persisted, reset to dashboard
        if (state && (state.currentPage === 'login' || state.currentPage === 'register')) {
          state.setPage('dashboard');
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
