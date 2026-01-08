import { useState, useRef } from 'react';
import { useVideoStore } from '../store/videoStore';
import { useUIStore } from '../store/uiStore';
import { apiClient } from '@/shared/api-client';
import { Button } from '../components/Button';

export function VideoReadyPage() {
  const { currentVideo, reset } = useVideoStore();
  const { setPage } = useUIStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDownload = async () => {
    if (!currentVideo?.id) return;

    setIsDownloading(true);
    try {
      // First try to get a fresh download URL from the API
      const { downloadUrl } = await apiClient.getDownloadUrl(currentVideo.id);

      if (!downloadUrl) {
        throw new Error('No download URL available');
      }

      // Generate a clean filename (just the filename, not full path)
      const baseFilename = `${currentVideo.productTitle?.replace(/[^a-z0-9]/gi, '_') || 'ugc-video'}.mp4`;

      // Use Chrome Downloads API to trigger "Save As" dialog
      // Note: Don't use absolute paths in filename - Chrome handles the folder via saveAs dialog
      const downloadId = await chrome.downloads.download({
        url: downloadUrl,
        filename: baseFilename,
        saveAs: true, // This forces the "Save As" dialog
      });

      if (!downloadId) {
        throw new Error('Download failed to start');
      }

      // Listen for download errors
      const listener = (delta: chrome.downloads.DownloadDelta) => {
        if (delta.id === downloadId) {
          if (delta.state?.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
          } else if (delta.state?.current === 'interrupted') {
            console.error('Download interrupted');
            chrome.downloads.onChanged.removeListener(listener);
          }
          if (delta.error) {
            console.error('Download error:', delta.error);
          }
        }
      };
      chrome.downloads.onChanged.addListener(listener);

    } catch (error) {
      console.error('Failed to download video:', error);

      // Fallback: use cloudinaryUrl directly
      try {
        const videoUrl = currentVideo.cloudinaryUrl || currentVideo.downloadUrl;
        if (videoUrl) {
          const baseFilename = `${currentVideo.productTitle?.replace(/[^a-z0-9]/gi, '_') || 'ugc-video'}.mp4`;

          const downloadId = await chrome.downloads.download({
            url: videoUrl,
            filename: baseFilename,
            saveAs: true,
          });

          if (!downloadId) {
            // Last resort: open in new tab
            window.open(videoUrl, '_blank');
          }
        }
      } catch (fallbackError) {
        console.error('Fallback download also failed:', fallbackError);
        // Open URL directly as last resort
        const videoUrl = currentVideo.cloudinaryUrl || currentVideo.downloadUrl;
        if (videoUrl) {
          window.open(videoUrl, '_blank');
        }
      }
    }
    setIsDownloading(false);
  };

  const handleNewVideo = () => {
    reset();
    setPage('dashboard');
  };

  const handlePlayClick = () => {
    setIsPlaying(true);
    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  if (!currentVideo) {
    return null;
  }

  const videoUrl = currentVideo.cloudinaryUrl || currentVideo.downloadUrl;

  const handleClosePlayer = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
  };

  return (
    <div className={`relative flex flex-col h-full animate-fade-in ${isPlaying ? 'bg-dark-900' : ''}`}>
      {/* Close button when playing */}
      {isPlaying && (
        <button
          onClick={handleClosePlayer}
          className="absolute top-3 right-3 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all"
          title="Close player"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      )}

      {/* Video Player */}
      <div className={`${isPlaying ? 'flex-1 flex items-center justify-center p-2' : 'p-4'}`}>
        <div className={`relative bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl overflow-hidden shadow-soft-lg mx-auto transition-all duration-300 ${
          isPlaying ? 'w-full max-w-[320px] h-auto' : 'aspect-[9/16] max-h-56'
        }`}>
          {/* Decorative glow */}
          {!isPlaying && (
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 rounded-2xl opacity-20 blur-xl" />
          )}

          <div className="relative h-full rounded-2xl overflow-hidden">
            {isPlaying && videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-auto max-h-[500px] object-contain cursor-pointer bg-black"
                onClick={handleVideoClick}
                onEnded={() => setIsPlaying(false)}
                controls
                playsInline
                autoPlay
              />
            ) : (
              <>
                {currentVideo.thumbnailUrl ? (
                  <img
                    src={currentVideo.thumbnailUrl}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <VideoIcon className="w-16 h-16 text-dark-600" />
                  </div>
                )}
                <button
                  onClick={handlePlayClick}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:bg-white group-hover:scale-110 transition-all">
                    <PlayIcon className="w-8 h-8 text-primary-600 ml-1" />
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Success Badge - Hidden when playing */}
      {!isPlaying && (
        <div className="px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-700 rounded-full text-sm font-medium animate-bounce-in">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <CheckIcon className="w-3 h-3 text-white" />
            </div>
            Video Ready!
          </div>
          <h3 className="text-xl font-bold text-dark-800 mt-4">
            Your UGC Video is Complete
          </h3>
          <p className="text-sm text-dark-500 mt-1 line-clamp-1">{currentVideo.productTitle}</p>
        </div>
      )}

      {/* Video Details - Hidden when playing */}
      {!isPlaying && (
        <div className="px-4 mt-4">
          <div className="glass rounded-2xl p-4 border border-dark-200/50">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <ClockIcon className="w-5 h-5 text-primary-600" />
                </div>
                <p className="text-xs text-dark-400">Duration</p>
                <p className="text-sm font-semibold text-dark-800">{currentVideo.videoDuration}s</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <SparkleIcon className="w-5 h-5 text-accent-600" />
                </div>
                <p className="text-xs text-dark-400">Style</p>
                <p className="text-sm font-semibold text-dark-800 capitalize">
                  {currentVideo.videoStyle.replace('_', ' ')}
                </p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <CalendarIcon className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-xs text-dark-400">Expires</p>
                <p className="text-sm font-semibold text-dark-800">7 days</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isPlaying && (
        <div className="p-4 mt-auto space-y-2">
          <Button
            onClick={handleDownload}
            className="w-full"
            size="lg"
            isLoading={isDownloading}
          >
            <DownloadIcon className="w-5 h-5 mr-2" />
            Download Video
          </Button>
          <Button onClick={handleNewVideo} variant="secondary" className="w-full">
            <PlusIcon className="w-5 h-5 mr-2" />
            Create Another Video
          </Button>
        </div>
      )}
    </div>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
