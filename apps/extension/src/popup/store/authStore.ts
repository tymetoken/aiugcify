import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeStorageAdapter } from '@/shared/chrome-storage';
import { apiClient } from '@/shared/api-client';
import type { UserPublic, AuthTokens } from '@aiugcify/shared-types';

interface AuthState {
  user: UserPublic | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isFirstLogin: boolean;
  isRefreshingCredits: boolean;
  _hasHydrated: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  startCreditAutoRefresh: () => void;
  stopCreditAutoRefresh: () => void;
  setTokens: (tokens: AuthTokens) => void;
  clearError: () => void;
  setFirstLogin: (value: boolean) => void;
  setHasHydrated: (value: boolean) => void;
}

// Store interval ID outside of state (not persisted)
let creditRefreshIntervalId: ReturnType<typeof setInterval> | null = null;
const CREDIT_REFRESH_INTERVAL = 30000; // 30 seconds

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      isFirstLogin: false,
      isRefreshingCredits: false,
      _hasHydrated: false,

      initialize: async () => {
        const { accessToken, refreshToken } = get();

        if (accessToken && refreshToken) {
          apiClient.setTokens(accessToken, refreshToken);
          apiClient.setOnTokenRefresh((tokens) => {
            set({
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
            });
          });
          apiClient.setOnAuthFailed(() => {
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
            });
          });

          try {
            const { user } = await apiClient.getMe();
            set({ user, isAuthenticated: true, isLoading: false });
          } catch {
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          set({ isLoading: false });
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const { user, tokens } = await apiClient.login(email, password);
          apiClient.setTokens(tokens.accessToken, tokens.refreshToken);
          apiClient.setOnTokenRefresh((newTokens) => {
            set({
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
            });
          });
          apiClient.setOnAuthFailed(() => {
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
            });
          });

          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: (err as Error).message,
            isLoading: false,
          });
          throw err;
        }
      },

      googleLogin: async (idToken: string) => {
        set({ isLoading: true, error: null });

        try {
          const { user, tokens } = await apiClient.googleAuth(idToken);
          apiClient.setTokens(tokens.accessToken, tokens.refreshToken);
          apiClient.setOnTokenRefresh((newTokens) => {
            set({
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
            });
          });
          apiClient.setOnAuthFailed(() => {
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
            });
          });

          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            isFirstLogin: user.creditBalance === 2, // New user if they have exactly 2 credits
          });
        } catch (err) {
          set({
            error: (err as Error).message,
            isLoading: false,
          });
          throw err;
        }
      },

      register: async (email: string, password: string, name?: string) => {
        set({ isLoading: true, error: null });

        try {
          const { user, tokens } = await apiClient.register(email, password, name);
          apiClient.setTokens(tokens.accessToken, tokens.refreshToken);
          apiClient.setOnTokenRefresh((newTokens) => {
            set({
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
            });
          });
          apiClient.setOnAuthFailed(() => {
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
            });
          });

          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            isFirstLogin: true, // Show welcome screen for new registrations
          });
        } catch (err) {
          set({
            error: (err as Error).message,
            isLoading: false,
          });
          throw err;
        }
      },

      logout: async () => {
        try {
          await apiClient.logout();
        } catch {
          // Ignore logout errors
        }

        apiClient.setTokens(null, null);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refreshUser: async () => {
        try {
          const { user } = await apiClient.getMe();
          set({ user });
        } catch {
          // Token might be expired
        }
      },

      setTokens: (tokens: AuthTokens) => {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
        apiClient.setTokens(tokens.accessToken, tokens.refreshToken);
      },

      clearError: () => set({ error: null }),

      setFirstLogin: (value: boolean) => set({ isFirstLogin: value }),

      setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),

      refreshCredits: async () => {
        set({ isRefreshingCredits: true });
        try {
          const { balance } = await apiClient.getBalance();
          const { user } = get();
          if (user) {
            set({ user: { ...user, creditBalance: balance } });
          }
        } catch {
          // Ignore errors
        }
        set({ isRefreshingCredits: false });
      },

      startCreditAutoRefresh: () => {
        if (creditRefreshIntervalId) return;
        creditRefreshIntervalId = setInterval(() => {
          get().refreshCredits();
        }, CREDIT_REFRESH_INTERVAL);
      },

      stopCreditAutoRefresh: () => {
        if (creditRefreshIntervalId) {
          clearInterval(creditRefreshIntervalId);
          creditRefreshIntervalId = null;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
