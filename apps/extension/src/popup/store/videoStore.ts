import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeStorageAdapter } from '@/shared/chrome-storage';
import { apiClient } from '@/shared/api-client';
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
  generationProgress: number;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  setAdditionalNotes: (notes: string) => void;
  generateScript: (productData: ProductData, additionalNotes?: string) => Promise<void>;
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
      generationProgress: 0,
      error: null,
      _hasHydrated: false,

      setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),

      setAdditionalNotes: (notes: string) => set({ additionalNotes: notes }),

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
          error: null,
          currentScript: null,
          currentVideo: null,
          isGenerating: false,
          generationProgress: 0,
        });

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
          });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
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
          set({
            error: (error as Error).message,
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
            set({
              isGenerating: false,
              error: (error as Error).message,
            });
          }
        };

        poll();
      },

      loadVideos: async () => {
        set({ isLoading: true });

        try {
          const { videos } = await apiClient.getVideos();
          set({ videos, isLoading: false });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
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
          generationProgress: 0,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
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
        generationProgress: state.generationProgress,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
