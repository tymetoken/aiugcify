import { useEffect, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';
import { useProductStore } from '../store/productStore';
import { useVideoStore } from '../store/videoStore';
import { useAuthStore } from '../store/authStore';

interface ShortcutHandlers {
  onGenerate?: () => void;
  onDownload?: () => void;
}

export function useKeyboardShortcuts(handlers?: ShortcutHandlers) {
  const { currentPage, setPage } = useUIStore();
  const { isOnProductPage, scrapeCurrentPage } = useProductStore();
  const { currentVideo } = useVideoStore();
  const { isAuthenticated } = useAuthStore();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't trigger if modifier keys are pressed (except for specific combos)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        // G - Generate video (when on product page and on dashboard)
        case 'g':
          if (currentPage === 'dashboard' && isOnProductPage && isAuthenticated) {
            event.preventDefault();
            handlers?.onGenerate?.();
          }
          break;

        // D - Download (when video is ready)
        case 'd':
          if (currentPage === 'video-ready' && currentVideo?.status === 'COMPLETED') {
            event.preventDefault();
            handlers?.onDownload?.();
          }
          break;

        // H - Go to history
        case 'h':
          if (isAuthenticated && !['login', 'register'].includes(currentPage)) {
            event.preventDefault();
            setPage('history');
          }
          break;

        // R - Refresh product data
        case 'r':
          if (currentPage === 'dashboard' && isOnProductPage) {
            event.preventDefault();
            scrapeCurrentPage();
          }
          break;

        // C - Go to credits
        case 'c':
          if (isAuthenticated && !['login', 'register'].includes(currentPage)) {
            event.preventDefault();
            setPage('credits');
          }
          break;

        // Escape - Go back
        case 'escape':
          event.preventDefault();
          handleEscape();
          break;

        // ? - Show shortcuts help modal
        case '?':
          if (event.shiftKey) {
            event.preventDefault();
            // Toggle keyboard shortcuts modal
            const { showKeyboardShortcuts, setShowKeyboardShortcuts } = useUIStore.getState();
            setShowKeyboardShortcuts(!showKeyboardShortcuts);
          }
          break;
      }
    },
    [currentPage, isOnProductPage, isAuthenticated, currentVideo, handlers, setPage, scrapeCurrentPage]
  );

  const handleEscape = useCallback(() => {
    // Navigate back based on current page
    switch (currentPage) {
      case 'product':
      case 'history':
      case 'credits':
        setPage('dashboard');
        break;
      case 'script-editor':
        setPage('product');
        break;
      case 'generating':
        // Can't go back during generation
        break;
      case 'video-ready':
        setPage('dashboard');
        break;
      case 'register':
        setPage('login');
        break;
      default:
        // Stay on current page
        break;
    }
  }, [currentPage, setPage]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    shortcuts: [
      { key: 'G', description: 'Generate video', available: currentPage === 'dashboard' && isOnProductPage },
      { key: 'D', description: 'Download video', available: currentPage === 'video-ready' },
      { key: 'H', description: 'Go to history', available: isAuthenticated },
      { key: 'R', description: 'Refresh product', available: currentPage === 'dashboard' && isOnProductPage },
      { key: 'C', description: 'Go to credits', available: isAuthenticated },
      { key: 'Esc', description: 'Go back', available: true },
    ],
  };
}
