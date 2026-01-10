import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeStorageAdapter } from '@/shared/chrome-storage';
import { apiClient } from '@/shared/api-client';
import { useAuthStore } from './authStore';
import type {
  Video,
  VideoListItem,
  VideoStyle,
  ProductData,
  GenerateScriptResponse,
} from '@aiugcify/shared-types';

interface VideoState {
  currentVideo: Video | null;
  currentScript: GenerateScriptResponse | null;
  editedScript: string;
  selectedStyle: VideoStyle;
  additionalNotes: string;
  videos: VideoListItem[];
  isLoading: boolean;
  isGenerating: boolean;
  isGeneratingScript: boolean; // Persisted state for script generation progress
  scriptGenerationStep: number; // Current step in script generation (1-3)
  generationProgress: number;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  setAdditionalNotes: (notes: string) => void;
  generateScript: (productData: ProductData, additionalNotes?: string) => Promise<void>;
  generateScriptDirect: (productData: ProductData, additionalNotes?: string) => Promise<void>;
  updateScript: (script: string) => void;
  saveScript: () => Promise<void>;
  setSelectedStyle: (style: VideoStyle) => void;
  confirmGeneration: () => Promise<void>;
  pollVideoStatus: () => Promise<void>;
  loadVideos: () => Promise<void>;
  loadVideo: (videoId: string) => Promise<Video>;
  retryVideo: (videoId: string) => Promise<void>;
  setCurrentVideo: (video: Video | null) => void;
  reset: () => void;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;
  resumePollingIfNeeded: () => void;
  setScriptGenerationStep: (step: number) => void;
  checkBackgroundGeneration: () => void;
}

export const useVideoStore = create<VideoState>()(
  persist(
    (set, get) => ({
      currentVideo: null,
      currentScript: null,
      editedScript: '',
      selectedStyle: 'PRODUCT_SHOWCASE',
      additionalNotes: '',
      videos: [],
      isLoading: false,
      isGenerating: false,
      isGeneratingScript: false,
      scriptGenerationStep: 0,
      generationProgress: 0,
      error: null,
      _hasHydrated: false,

      setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),

      setAdditionalNotes: (notes: string) => set({ additionalNotes: notes }),

      setScriptGenerationStep: (step: number) => set({ scriptGenerationStep: step }),

      resumePollingIfNeeded: () => {
        const { isGenerating, currentVideo, currentScript } = get();
        const videoId = currentVideo?.id || currentScript?.videoId;

        if (isGenerating && videoId) {
          // Resume polling for video status
          get().pollVideoStatus();
        }
      },

      generateScript: async (productData: ProductData, additionalNotes?: string) => {
        const { selectedStyle } = get();
        // Reset any old video state before generating new script
        set({
          isLoading: true,
          isGeneratingScript: true,
          scriptGenerationStep: 1,
          error: null,
          currentScript: null,
          currentVideo: null,
          isGenerating: false,
          generationProgress: 0,
        });

        try {
          // Get API URL from environment
          const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

          // Delegate to service worker for background processing
          // This continues even if popup is closed
          chrome.runtime.sendMessage(
            {
              type: 'GENERATE_SCRIPT',
              data: {
                productData,
                videoStyle: selectedStyle,
                options: {
                  tone: 'enthusiastic',
                  targetDuration: 20,
                  additionalNotes,
                },
                apiBaseUrl, // Pass API URL to service worker
              },
            },
            (response) => {
              if (chrome.runtime.lastError) {
                // Service worker might not be ready, fallback to direct API call
                console.warn('[VideoStore] Service worker error, using direct API call');
                get().generateScriptDirect(productData, additionalNotes);
                return;
              }

              if (response?.success && response.result) {
                // Script generated successfully
                set({
                  currentScript: response.result as GenerateScriptResponse,
                  editedScript: (response.result as GenerateScriptResponse).script,
                  isLoading: false,
                  isGeneratingScript: false,
                  scriptGenerationStep: 0,
                });
                // Refresh user to update credit balance
                useAuthStore.getState().refreshUser();
                // Refresh videos list so the new script appears in history
                get().loadVideos();
              } else if (response?.error) {
                set({
                  error: response.error,
                  isLoading: false,
                  isGeneratingScript: false,
                  scriptGenerationStep: 0,
                });
              }
              // If no response, the popup was closed and storage will be updated by service worker
            }
          );
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
            isGeneratingScript: false,
            scriptGenerationStep: 0,
          });
          throw error;
        }
      },

      // Fallback direct API call if service worker is unavailable
      generateScriptDirect: async (productData: ProductData, additionalNotes?: string) => {
        const { selectedStyle } = get();

        // Progress step 2 after a delay
        setTimeout(() => {
          if (get().isGeneratingScript) {
            set({ scriptGenerationStep: 2 });
          }
        }, 2000);

        // Progress step 3 after a longer delay
        setTimeout(() => {
          if (get().isGeneratingScript) {
            set({ scriptGenerationStep: 3 });
          }
        }, 5000);

        try {
          const response = await apiClient.generateScript(productData, selectedStyle, {
            tone: 'enthusiastic',
            targetDuration: 20,
            additionalNotes,
          });

          set({
            currentScript: response,
            editedScript: response.script,
            isLoading: false,
            isGeneratingScript: false,
            scriptGenerationStep: 0,
          });

          // Refresh user to update credit balance after script generation
          useAuthStore.getState().refreshUser();
          // Refresh videos list so the new script appears in history
          get().loadVideos();
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
            isGeneratingScript: false,
            scriptGenerationStep: 0,
          });
          throw error;
        }
      },

      updateScript: (script: string) => {
        set({ editedScript: script });
      },

      saveScript: async () => {
        const { currentScript, editedScript } = get();
        if (!currentScript) return;

        set({ isLoading: true, error: null });

        try {
          const { video } = await apiClient.updateScript(currentScript.videoId, editedScript);
          set({ currentVideo: video, isLoading: false });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
          throw error;
        }
      },

      setSelectedStyle: (style: VideoStyle) => {
        set({ selectedStyle: style });
      },

      confirmGeneration: async () => {
        const { currentScript } = get();
        if (!currentScript) return;

        set({ isLoading: true, error: null });

        try {
          // First check if video is still in SCRIPT_READY status
          const { video: currentVideo } = await apiClient.getVideo(currentScript.videoId);

          if (currentVideo.status !== 'SCRIPT_READY') {
            // Video is no longer in SCRIPT_READY status - handle based on current status
            set({
              currentVideo,
              currentScript: null, // Clear stale script
              isLoading: false,
            });

            if (['QUEUED', 'GENERATING', 'PROCESSING'].includes(currentVideo.status)) {
              // Video is already being generated, start polling
              set({ isGenerating: true, generationProgress: 20 });
              get().pollVideoStatus();
            }
            return;
          }

          const { video } = await apiClient.confirmGeneration(currentScript.videoId);
          set({
            currentVideo: video,
            isGenerating: true,
            generationProgress: 0,
            isLoading: false,
          });

          // Start polling
          get().pollVideoStatus();
        } catch (error) {
          const errorMessage = (error as Error).message;

          // Handle stale video ID - video no longer exists in database
          if (errorMessage.includes('Video not found') || errorMessage.includes('not found')) {
            set({
              currentScript: null,
              currentVideo: null,
              editedScript: '',
              isLoading: false,
              error: 'This script session has expired. Please generate a new script.',
            });
            return;
          }

          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      pollVideoStatus: async () => {
        const { currentVideo, currentScript } = get();
        const videoId = currentVideo?.id || currentScript?.videoId;

        if (!videoId) return;

        const poll = async () => {
          try {
            // Wait for auth to be ready before making API calls
            const authState = useAuthStore.getState();
            if (!authState.accessToken) {
              // Auth not ready yet, wait and retry
              console.log('[VideoStore] Waiting for auth to be ready...');
              setTimeout(poll, 1000);
              return;
            }

            const { video } = await apiClient.getVideo(videoId);
            set({ currentVideo: video });

            if (video.status === 'GENERATING' || video.status === 'PROCESSING' || video.status === 'QUEUED') {
              // Estimate progress based on status
              const progress = video.status === 'PROCESSING' ? 80 : video.status === 'GENERATING' ? 50 : 20;
              set({ generationProgress: progress });
              setTimeout(poll, 5000); // Poll every 5 seconds
            } else if (video.status === 'COMPLETED') {
              set({
                isGenerating: false,
                generationProgress: 100,
              });
              // Send notification via service worker
              chrome.runtime.sendMessage({
                type: 'VIDEO_COMPLETED',
                data: {
                  productTitle: video.productTitle,
                  videoId: video.id,
                },
              });
            } else if (video.status === 'FAILED') {
              set({
                isGenerating: false,
                error: video.errorMessage || 'Video generation failed',
              });
              // Send failure notification via service worker
              chrome.runtime.sendMessage({
                type: 'VIDEO_FAILED',
                data: {
                  productTitle: video.productTitle,
                  videoId: video.id,
                  error: video.errorMessage,
                },
              });
            }
          } catch (error) {
            const errorMessage = (error as Error).message;

            // Handle stale video ID - stop polling and clear state
            if (errorMessage.includes('Video not found') || errorMessage.includes('not found')) {
              set({
                currentScript: null,
                currentVideo: null,
                isGenerating: false,
                error: 'Video session expired. Please generate a new script.',
              });
              return;
            }

            set({
              isGenerating: false,
              error: errorMessage,
            });
          }
        };

        poll();
      },

      loadVideos: async () => {
        set({ isLoading: true });

        try {
          const response = await apiClient.getVideos();
          const videos = response?.videos || [];
          set({ videos, isLoading: false });
        } catch (error) {
          // Don't show error for video list failures - just log and continue
          console.warn('[VideoStore] Failed to load videos:', (error as Error).message);
          set({ isLoading: false });
        }
      },

      loadVideo: async (videoId: string) => {
        set({ isLoading: true, error: null });

        try {
          const { video } = await apiClient.getVideo(videoId);
          set({
            currentVideo: video,
            editedScript: video.editedScript || video.generatedScript || '',
            isLoading: false,
          });
          return video;
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
          throw error;
        }
      },

      retryVideo: async (videoId: string) => {
        set({ isLoading: true, error: null });

        try {
          const { video } = await apiClient.retryVideo(videoId);
          set({
            currentVideo: video,
            isGenerating: true,
            generationProgress: 0,
            isLoading: false,
          });

          // Refresh user to update credit balance after retry (costs 1 credit)
          useAuthStore.getState().refreshUser();

          // Start polling for status
          get().pollVideoStatus();
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
          throw error;
        }
      },

      setCurrentVideo: (video) => {
        set({ currentVideo: video });
      },

      reset: () => {
        set({
          currentVideo: null,
          currentScript: null,
          editedScript: '',
          additionalNotes: '',
          isGenerating: false,
          isGeneratingScript: false,
          scriptGenerationStep: 0,
          generationProgress: 0,
          error: null,
        });
      },

      clearError: () => set({ error: null }),

      // Check if script generation is still running in background
      checkBackgroundGeneration: () => {
        chrome.runtime.sendMessage(
          { type: 'CHECK_SCRIPT_GENERATION_STATUS' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[VideoStore] Could not check background status');
              return;
            }

            if (response?.isGenerating) {
              // Generation is still in progress, ensure UI shows loading state
              set({ isGeneratingScript: true, isLoading: true });
            } else {
              // Generation is not in progress
              // Check if we have a completed script in storage that wasn't reflected in state
              const { isGeneratingScript, currentScript } = get();
              if (isGeneratingScript && currentScript) {
                // Script was completed while popup was closed - refresh user credits
                set({ isGeneratingScript: false, isLoading: false, scriptGenerationStep: 0 });
                useAuthStore.getState().refreshUser();
              } else if (isGeneratingScript && !currentScript) {
                // Was generating but no script - might have failed, reset state
                set({ isGeneratingScript: false, isLoading: false, scriptGenerationStep: 0 });
              }
            }
          }
        );
      },
    }),
    {
      name: 'video-storage',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        currentVideo: state.currentVideo,
        currentScript: state.currentScript,
        editedScript: state.editedScript,
        selectedStyle: state.selectedStyle,
        additionalNotes: state.additionalNotes,
        isGenerating: state.isGenerating,
        // Persist script generation state so popup can resume showing progress
        isGeneratingScript: state.isGeneratingScript,
        scriptGenerationStep: state.scriptGenerationStep,
        generationProgress: state.generationProgress,
        error: state.error,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // Check background generation status when popup reopens
        setTimeout(() => {
          state?.checkBackgroundGeneration();
          // Reload videos when auth is ready
          const checkAndLoadVideos = () => {
            const authState = useAuthStore.getState();
            if (authState.accessToken) {
              state?.loadVideos();
            } else {
              // Wait for auth, retry in 500ms
              setTimeout(checkAndLoadVideos, 500);
            }
          };
          checkAndLoadVideos();
        }, 100);
      },
    }
  )
);
