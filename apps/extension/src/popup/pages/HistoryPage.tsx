import { useEffect, useState } from 'react';
import { useVideoStore } from '../store/videoStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { LoginModal } from '../components/LoginModal';
import type { VideoStatus, VideoListItem } from '@aiugcify/shared-types';

const STATUS_CONFIG: Record<VideoStatus, { label: string; bgColor: string; textColor: string; dotColor: string }> = {
  PENDING_SCRIPT: { label: 'Draft', bgColor: 'bg-dark-100', textColor: 'text-dark-600', dotColor: 'bg-dark-400' },
  SCRIPT_READY: { label: 'Script Ready', bgColor: 'bg-blue-50', textColor: 'text-blue-700', dotColor: 'bg-blue-500' },
  QUEUED: { label: 'Queued', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', dotColor: 'bg-yellow-500' },
  GENERATING: { label: 'Generating', bgColor: 'bg-purple-50', textColor: 'text-purple-700', dotColor: 'bg-purple-500 animate-pulse' },
  PROCESSING: { label: 'Processing', bgColor: 'bg-purple-50', textColor: 'text-purple-700', dotColor: 'bg-purple-500 animate-pulse' },
  COMPLETED: { label: 'Ready', bgColor: 'bg-green-50', textColor: 'text-green-700', dotColor: 'bg-green-500' },
  FAILED: { label: 'Failed', bgColor: 'bg-red-50', textColor: 'text-red-700', dotColor: 'bg-red-500' },
  CANCELLED: { label: 'Cancelled', bgColor: 'bg-dark-100', textColor: 'text-dark-600', dotColor: 'bg-dark-400' },
  EXPIRED: { label: 'Expired', bgColor: 'bg-orange-50', textColor: 'text-orange-700', dotColor: 'bg-orange-500' },
};

export function HistoryPage() {
  const { videos, loadVideos, loadVideo, retryVideo, isLoading } = useVideoStore();
  const { setPage } = useUIStore();
  const { isAuthenticated } = useAuthStore();
  const [loadingVideoId, setLoadingVideoId] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadVideos();
    }
  }, [loadVideos, isAuthenticated]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleVideoClick = async (video: VideoListItem) => {
    setLoadingVideoId(video.id);
    try {
      const fullVideo = await loadVideo(video.id);

      switch (fullVideo.status) {
        case 'COMPLETED':
          setPage('video-ready');
          break;
        case 'GENERATING':
        case 'PROCESSING':
        case 'QUEUED':
          setPage('generating');
          break;
        case 'SCRIPT_READY':
          setPage('script-editor');
          break;
        case 'FAILED':
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Failed to load video:', error);
    }
    setLoadingVideoId(null);
  };

  const handleRetry = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    setLoadingVideoId(videoId);
    try {
      await retryVideo(videoId);
      setPage('generating');
    } catch (error) {
      console.error('Failed to retry video:', error);
    }
    setLoadingVideoId(null);
  };

  // Show login prompt for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-dark-800 text-lg">Video History</h3>
            <p className="text-xs text-dark-400 mt-0.5">Sign in to view your videos</p>
          </div>
        </div>

        {/* Login Prompt */}
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-accent-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <VideoIcon className="w-10 h-10 text-primary-500" />
          </div>
          <h4 className="font-semibold text-dark-800 text-lg">Sign in to view your videos</h4>
          <p className="text-sm text-dark-400 mt-1 max-w-xs mx-auto">
            Your generated videos will appear here after you sign in
          </p>
          <Button onClick={() => setShowLoginModal(true)} className="mt-6">
            Sign In
          </Button>
        </div>

        {/* Back Button */}
        <Button onClick={() => setPage('dashboard')} variant="ghost" className="w-full">
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Login Modal */}
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false);
            loadVideos();
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-dark-800 text-lg">Video History</h3>
          <p className="text-xs text-dark-400 mt-0.5">{videos.length} videos generated</p>
        </div>
        <Button onClick={() => loadVideos()} variant="ghost" size="sm" isLoading={isLoading}>
          <RefreshIcon className="w-4 h-4" />
        </Button>
      </div>

      {isLoading && videos.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl p-4 animate-shimmer">
              <div className="flex gap-3">
                <div className="w-16 h-16 bg-dark-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-dark-200 rounded-lg w-3/4" />
                  <div className="h-3 bg-dark-200 rounded-lg w-1/2" />
                  <div className="h-5 bg-dark-200 rounded-full w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-accent-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <VideoIcon className="w-10 h-10 text-primary-500" />
          </div>
          <h4 className="font-semibold text-dark-800 text-lg">No videos yet</h4>
          <p className="text-sm text-dark-400 mt-1 max-w-xs mx-auto">
            Generate your first UGC video from any TikTok Shop product
          </p>
          <Button onClick={() => setPage('dashboard')} className="mt-6">
            <SparkleIcon className="w-4 h-4 mr-2" />
            Get Started
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video, index) => {
            const status = STATUS_CONFIG[video.status];
            const isCardLoading = loadingVideoId === video.id;
            const isClickable = !['CANCELLED', 'EXPIRED', 'PENDING_SCRIPT'].includes(video.status);

            return (
              <div
                key={video.id}
                className={`glass rounded-2xl p-4 border border-dark-200/50 transition-all animate-fade-in-up ${
                  isClickable ? 'hover:border-primary-300 hover:shadow-soft-lg cursor-pointer' : 'opacity-60'
                } ${isCardLoading ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => isClickable && !isCardLoading && handleVideoClick(video)}
              >
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-dark-100">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <VideoIcon className="w-6 h-6 text-dark-300" />
                      </div>
                    )}

                    {/* Loading overlay */}
                    {isCardLoading && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <LoadingSpinner className="w-6 h-6 text-primary-500" />
                      </div>
                    )}

                    {/* Play button for completed videos */}
                    {video.status === 'COMPLETED' && !isCardLoading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                          <PlayIcon className="w-4 h-4 text-primary-600 ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-dark-800 line-clamp-1">
                      {video.productTitle}
                    </p>
                    <p className="text-xs text-dark-400 mt-0.5 capitalize">
                      {video.videoStyle.replace('_', ' ')}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${status.bgColor} ${status.textColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                        {status.label}
                      </span>
                      <span className="text-xs text-dark-300">{formatDate(video.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center">
                    {video.status === 'FAILED' && (
                      <button
                        onClick={(e) => handleRetry(e, video.id)}
                        disabled={isCardLoading}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="Retry generation"
                      >
                        <RetryIcon className="w-5 h-5" />
                      </button>
                    )}
                    {video.status === 'COMPLETED' && (
                      <ChevronRightIcon className="w-5 h-5 text-dark-300" />
                    )}
                    {(video.status === 'GENERATING' || video.status === 'PROCESSING' || video.status === 'QUEUED') && (
                      <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Back Button */}
      <Button onClick={() => setPage('dashboard')} variant="ghost" className="w-full">
        <ArrowLeftIcon className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
    </div>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <path d="M10 8l6 4-6 4V8z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
