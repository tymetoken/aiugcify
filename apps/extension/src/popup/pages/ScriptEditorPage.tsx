import { useState } from 'react';
import { useVideoStore } from '../store/videoStore';
import { useUIStore } from '../store/uiStore';
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
    isLoading,
    error,
    clearError,
  } = useVideoStore();
  const { setPage } = useUIStore();
  const [localError, setLocalError] = useState<string | null>(null);

  // Use currentScript if available, otherwise use currentVideo for videos loaded from history
  const videoId = currentScript?.videoId || currentVideo?.id;
  const script = editedScript || currentVideo?.generatedScript || currentVideo?.editedScript || '';
  const estimatedDuration = currentScript?.estimatedDuration || currentVideo?.videoDuration || 20;

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
      <div className="p-4 border-b border-slate-200 bg-white">
        <h3 className="font-semibold text-slate-800">Review Your Script</h3>
        <p className="text-sm text-slate-500 mt-1">
          Edit the script below or confirm to start video generation
        </p>
      </div>

      {/* Script Editor */}
      <div className="flex-1 p-4 overflow-y-auto">
        <textarea
          value={script}
          onChange={(e) => updateScript(e.target.value)}
          className="w-full h-64 p-3 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Your script will appear here..."
        />

        {(error || localError) && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{localError || error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-200 bg-white space-y-2">
        <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
          <span>Estimated duration: {estimatedDuration}s</span>
          <span>Cost: 1 Credit</span>
        </div>
        <Button
          onClick={handleConfirm}
          className="w-full"
          size="lg"
          isLoading={isLoading}
        >
          Generate Video
        </Button>
        <Button
          onClick={() => setPage(currentScript ? 'product' : 'history')}
          variant="ghost"
          className="w-full"
        >
          Back
        </Button>
      </div>
    </div>
  );
}
