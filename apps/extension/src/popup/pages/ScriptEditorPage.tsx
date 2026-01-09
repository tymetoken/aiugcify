import { useState } from 'react';
import { useVideoStore } from '../store/videoStore';
import { useProductStore } from '../store/productStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '@/shared/api-client';
import { Button } from '../components/Button';

export function ScriptEditorPage() {
  const {
    currentScript,
    currentVideo,
    editedScript,
    updateScript,
    confirmGeneration,
    setCurrentVideo,
    selectedStyle,
    isLoading,
    error,
    clearError,
  } = useVideoStore();
  const { scrapedProduct } = useProductStore();
  const { setPage } = useUIStore();
  const { user } = useAuthStore();
  const [localError, setLocalError] = useState<string | null>(null);

  // Check if user has active subscription
  const hasSubscription = user?.hasActiveSubscription ?? false;

  // Use currentScript if available, otherwise use currentVideo for videos loaded from history
  const videoId = currentScript?.videoId || currentVideo?.id;
  const script = editedScript || currentVideo?.generatedScript || currentVideo?.editedScript || '';
  const estimatedDuration = currentScript?.estimatedDuration || currentVideo?.videoDuration || 20;

  // Get product info from scraped product or from video data
  const productTitle = scrapedProduct?.title || currentVideo?.productTitle;
  const productImage = scrapedProduct?.images?.[0] || currentVideo?.productImages?.[0];
  const videoStyle = currentVideo?.videoStyle || selectedStyle;

  const handleConfirm = async () => {
    setLocalError(null);
    clearError();

    try {
      if (currentScript) {
        await confirmGeneration();
        setPage('generating');
      } else if (currentVideo) {
        // For videos loaded from history, first refresh to check current status
        const { video: refreshedVideo } = await apiClient.getVideo(currentVideo.id);

        // If video is no longer in SCRIPT_READY status, redirect appropriately
        if (refreshedVideo.status !== 'SCRIPT_READY') {
          setCurrentVideo(refreshedVideo);

          switch (refreshedVideo.status) {
            case 'COMPLETED':
              setPage('video-ready');
              return;
            case 'GENERATING':
            case 'PROCESSING':
            case 'QUEUED':
              setPage('generating');
              return;
            case 'FAILED':
              setLocalError('This video generation failed. Please retry from history.');
              return;
            default:
              setLocalError(`Video is in ${refreshedVideo.status} status and cannot be generated.`);
              return;
          }
        }

        // Status is SCRIPT_READY, proceed with confirmation
        const { video } = await apiClient.confirmGeneration(currentVideo.id);
        setCurrentVideo(video);
        setPage('generating');
      }
    } catch (err) {
      const errorMessage = (err as Error).message;

      // Handle specific status error - video was already processed
      if (errorMessage.includes('SCRIPT_READY')) {
        // Refresh video to get current status and redirect
        try {
          const { video: refreshedVideo } = await apiClient.getVideo(videoId!);
          setCurrentVideo(refreshedVideo);

          if (refreshedVideo.status === 'COMPLETED') {
            setPage('video-ready');
          } else if (['GENERATING', 'PROCESSING', 'QUEUED'].includes(refreshedVideo.status)) {
            setPage('generating');
          } else {
            setLocalError(`Video status changed to ${refreshedVideo.status}.`);
          }
        } catch {
          setLocalError(errorMessage);
        }
      } else {
        setLocalError(errorMessage);
      }
    }
  };

  if (!videoId) {
    return (
      <div className="p-4 text-center">
        <p className="text-slate-500">No script available</p>
        <Button onClick={() => setPage('dashboard')} variant="secondary" className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-200 bg-white">
        <h3 className="font-semibold text-slate-800">Review Your Script</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          {hasSubscription
            ? 'Edit the script below or confirm to generate'
            : 'Preview the script below and confirm to generate'
          }
        </p>
      </div>

      {/* Product Preview */}
      {productTitle && (
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            {productImage && (
              <img
                src={productImage}
                alt={productTitle}
                className="w-10 h-10 object-cover rounded-lg flex-shrink-0 border border-slate-200"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 line-clamp-1">{productTitle}</p>
              {videoStyle && (
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 text-primary-700 capitalize">
                  {videoStyle.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Script Editor */}
      <div className="flex-1 px-4 py-3 overflow-y-auto">
        <div className="relative h-full">
          <textarea
            value={script}
            onChange={(e) => hasSubscription && updateScript(e.target.value)}
            readOnly={!hasSubscription}
            className={`w-full h-full min-h-[240px] p-3 border rounded-lg text-sm resize-none focus:outline-none transition-all ${
              hasSubscription
                ? 'border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white'
                : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed blur-[2px] select-none'
            }`}
            placeholder="Your script will appear here..."
          />

          {/* Subscription upgrade overlay for non-subscribers */}
          {!hasSubscription && (
            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto bg-white border border-primary-200 rounded-xl shadow-xl p-4 flex flex-col items-center gap-3 text-center max-w-[220px]">
                <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-md">
                  <LockIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Unlock Script Editing</p>
                  <p className="text-xs text-slate-500 mt-0.5">Subscribe to customize your scripts</p>
                </div>
                <button
                  onClick={() => setPage('credits')}
                  className="w-full bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  Upgrade
                </button>
              </div>
            </div>
          )}
        </div>

        {(error || localError) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{localError || error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
          <span>Estimated duration: {estimatedDuration}s</span>
          <span>Cost: 1 Credit</span>
        </div>
        <Button
          onClick={handleConfirm}
          className="w-full"
          size="lg"
          isLoading={isLoading}
        >
          <RocketIcon className="w-4 h-4 mr-2" />
          Start Generating
        </Button>
      </div>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

