import { useEffect } from 'react';
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
import { useUIStore } from './store/uiStore';

export default function App() {
  const { isAuthenticated, initialize, isLoading: authLoading, isFirstLogin, refreshUser } = useAuthStore();
  const { checkCurrentTab, setScrapedProduct, _hasHydrated: productHydrated } = useProductStore();
  const { currentPage, setPage, _hasHydrated: uiHydrated } = useUIStore();
  const { resumePollingIfNeeded, _hasHydrated: videoHydrated } = useVideoStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Refresh user data (including credits) when popup opens and user is authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      refreshUser();
    }
  }, [isAuthenticated, authLoading, refreshUser]);

  // Check current tab for all users (authenticated or not)
  useEffect(() => {
    checkCurrentTab();
  }, [checkCurrentTab]);

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

  // Wait for all stores to hydrate from Chrome storage
  const isHydrating = !uiHydrated || !videoHydrated || !productHydrated;

  if (authLoading || isHydrating) {
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
    </div>
  );
}
