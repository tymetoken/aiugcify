import { useEffect, useRef } from 'react';
import { useAuthStore } from './store/authStore';
import { useProductStore } from './store/productStore';
import { useVideoStore } from './store/videoStore';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { WelcomePage } from './pages/WelcomePage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductPage } from './pages/ProductPage';
import { ScriptEditorPage } from './pages/ScriptEditorPage';
import { GeneratingPage } from './pages/GeneratingPage';
import { VideoReadyPage } from './pages/VideoReadyPage';
import { CreditsPage } from './pages/CreditsPage';
import { HistoryPage } from './pages/HistoryPage';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { useUIStore } from './store/uiStore';
import type { GenerateScriptResponse } from '@aiugcify/shared-types';

export default function App() {
  const { isAuthenticated, initialize, isLoading: authLoading, isFirstLogin, refreshUser } = useAuthStore();
  const { checkCurrentTab, setScrapedProduct, _hasHydrated: productHydrated } = useProductStore();
  const { currentPage, setPage, _hasHydrated: uiHydrated, showKeyboardShortcuts, setShowKeyboardShortcuts } = useUIStore();
  const { resumePollingIfNeeded, _hasHydrated: videoHydrated, isGeneratingScript, currentScript } = useVideoStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Refresh user data (including credits) when popup opens and user is authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      refreshUser();
    }
  }, [isAuthenticated, authLoading, refreshUser]);

  // Refresh user data when the popup becomes visible (user clicks on extension again)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && !authLoading) {
        refreshUser();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, authLoading, refreshUser]);

  // Check current tab only when on dashboard (don't clear product data during workflow)
  useEffect(() => {
    // Only check tab when on dashboard - preserve product data during workflow
    if (uiHydrated && currentPage === 'dashboard') {
      checkCurrentTab();
    }
  }, [checkCurrentTab, currentPage, uiHydrated]);

  // Listen for product page navigation changes and reset to dashboard
  useEffect(() => {
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'PRODUCT_PAGE_CHANGED') {
        // Clear old product data immediately
        setScrapedProduct(null);
        // Reset to dashboard when user navigates to a new product page
        setPage('dashboard');
        // Re-check the current tab to get fresh product data
        checkCurrentTab();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [setPage, setScrapedProduct, checkCurrentTab]);

  // Resume video polling if there was an in-progress generation
  useEffect(() => {
    if (videoHydrated) {
      resumePollingIfNeeded();
    }
  }, [videoHydrated, resumePollingIfNeeded]);

  // Track previous authentication state to detect automatic sign-outs
  const wasAuthenticated = useRef<boolean | null>(null);

  // Navigate to dashboard when user is automatically signed out
  useEffect(() => {
    // Skip during initial load
    if (authLoading) return;

    // If user was authenticated but is now signed out, go to dashboard
    if (wasAuthenticated.current === true && !isAuthenticated) {
      setPage('dashboard');
    }

    // Update the ref after processing
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, authLoading, setPage]);

  // Navigate based on script generation state (for popup reopen scenarios)
  useEffect(() => {
    if (!videoHydrated) return;

    // If script generation is in progress, show ProductPage with progress overlay
    if (isGeneratingScript && currentPage !== 'product') {
      setPage('product');
      return;
    }

    // If script generation completed (script exists, not generating), navigate to script-editor
    // Only navigate if we're still on the product page (meaning we were waiting for generation)
    if (!isGeneratingScript && currentScript && currentPage === 'product') {
      setPage('script-editor');
    }
  }, [videoHydrated, isGeneratingScript, currentScript, currentPage, setPage]);

  // Listen for storage changes from service worker (background script generation)
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes['video-storage']) {
        try {
          const newValue = JSON.parse(changes['video-storage'].newValue || '{}');
          const state = newValue.state || {};

          // Sync script generation progress from background
          const videoStore = useVideoStore.getState();

          // Update script generation step for progress animation
          if (state.scriptGenerationStep !== undefined && state.scriptGenerationStep !== videoStore.scriptGenerationStep) {
            videoStore.setScriptGenerationStep(state.scriptGenerationStep);
          }

          // If script generation completed in background
          if (state.currentScript && !state.isGeneratingScript && videoStore.isGeneratingScript) {
            // Directly update store with completed script
            useVideoStore.setState({
              currentScript: state.currentScript as GenerateScriptResponse,
              editedScript: state.currentScript.script,
              isGeneratingScript: false,
              isLoading: false,
              scriptGenerationStep: 0,
              error: state.error || null,
            });
            // Refresh user credits
            refreshUser();
            // Refresh videos list so the new script appears in history
            useVideoStore.getState().loadVideos();
            // Navigate to script editor to show the completed script
            setPage('script-editor');
          }

          // If error occurred in background
          if (state.error && !state.isGeneratingScript && videoStore.isGeneratingScript) {
            useVideoStore.setState({
              error: state.error,
              isGeneratingScript: false,
              isLoading: false,
              scriptGenerationStep: 0,
            });
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    chrome.storage.local.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, [refreshUser, setPage]);

  // Wait for all stores to hydrate from Chrome storage
  const isHydrating = !uiHydrated || !videoHydrated || !productHydrated;

  if (isHydrating) {
    return (
      <div className="min-h-[480px] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show full-page login/register only when explicitly navigating to those pages
  if (currentPage === 'login') {
    return <LoginPage onRegister={() => setPage('register')} />;
  }
  if (currentPage === 'register') {
    return <RegisterPage onLogin={() => setPage('login')} />;
  }

  // Show welcome page for first-time users after registration
  if (isAuthenticated && isFirstLogin) {
    return <WelcomePage />;
  }

  // Pages that require authentication - redirect to login
  const authRequiredPages = ['script-editor', 'generating', 'video-ready'];
  if (!isAuthenticated && authRequiredPages.includes(currentPage)) {
    setPage('dashboard');
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'product':
        return <ProductPage />;
      case 'script-editor':
        return <ScriptEditorPage />;
      case 'generating':
        return <GeneratingPage />;
      case 'video-ready':
        return <VideoReadyPage />;
      case 'credits':
        return <CreditsPage />;
      case 'history':
        return <HistoryPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-[480px] bg-slate-50 flex flex-col relative">
      <Header />
      <main className="flex-1 overflow-y-auto">{renderPage()}</main>
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
}
