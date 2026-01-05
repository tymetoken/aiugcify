import { useEffect, useState } from 'react';
import { useVideoStore } from '../store/videoStore';
import { useProductStore } from '../store/productStore';
import { useUIStore } from '../store/uiStore';

const GENERATION_STAGES = [
  {
    id: 'queued',
    label: 'In Queue',
    description: 'Preparing your request',
    icon: 'queue',
  },
  {
    id: 'generating',
    label: 'AI Creating',
    description: 'Generating video scenes',
    icon: 'sparkle',
  },
  {
    id: 'processing',
    label: 'Processing',
    description: 'Rendering final video',
    icon: 'render',
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Your video is ready!',
    icon: 'check',
  },
];

export function GeneratingPage() {
  const { currentVideo, generationProgress, error, pollVideoStatus, isGenerating } = useVideoStore();
  const { scrapedProduct } = useProductStore();
  const { setPage } = useUIStore();
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (
      currentVideo &&
      ['QUEUED', 'GENERATING', 'PROCESSING'].includes(currentVideo.status) &&
      !isGenerating
    ) {
      pollVideoStatus();
    }
  }, [currentVideo, isGenerating, pollVideoStatus]);

  useEffect(() => {
    if (currentVideo?.status === 'COMPLETED') {
      setPage('video-ready');
    }
  }, [currentVideo?.status, setPage]);

  // Timer for elapsed time
  useEffect(() => {
    if (currentVideo && ['QUEUED', 'GENERATING', 'PROCESSING'].includes(currentVideo.status)) {
      const timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [currentVideo?.status]);

  const getCurrentStageIndex = () => {
    if (!currentVideo) return 0;
    switch (currentVideo.status) {
      case 'QUEUED':
        return 0;
      case 'GENERATING':
        return 1;
      case 'PROCESSING':
        return 2;
      case 'COMPLETED':
        return 3;
      default:
        return 0;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentStageIndex = getCurrentStageIndex();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center">
            <XIcon className="w-10 h-10 text-red-500" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-dark-800 mt-6 mb-2">Generation Failed</h3>
        <p className="text-sm text-dark-500 text-center max-w-xs mb-6">{error}</p>
        <button
          onClick={() => setPage('dashboard')}
          className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-accent-500 text-white font-medium rounded-xl shadow-glow hover:shadow-glow-lg transition-all hover:scale-105"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-[480px] overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-accent-50">
        {/* Floating orbs */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-primary-200/40 to-accent-200/40 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-5 w-40 h-40 bg-gradient-to-br from-accent-200/40 to-primary-200/40 rounded-full blur-3xl animate-float" style={{ animationDelay: '-1.5s' }} />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-gradient-to-br from-primary-300/30 to-accent-300/30 rounded-full blur-2xl animate-pulse-slow" />
      </div>

      <div className="relative z-10 flex flex-col items-center p-6 animate-fade-in">
        {/* Product Preview Card */}
        {scrapedProduct && (
          <div className="w-full max-w-xs mb-6 animate-fade-in-up">
            <div className="glass rounded-2xl p-3 border border-white/50 shadow-soft">
              <div className="flex items-center gap-3">
                {scrapedProduct.images[0] && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-accent-400 rounded-xl blur opacity-30 animate-pulse-slow" />
                    <img
                      src={scrapedProduct.images[0]}
                      alt={scrapedProduct.title}
                      className="relative w-14 h-14 object-cover rounded-xl ring-2 ring-white/50"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-dark-400 mb-0.5">Creating video for</p>
                  <p className="text-sm font-medium text-dark-800 truncate">{scrapedProduct.title}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Progress Circle */}
        <div className="relative w-40 h-40 mb-6">
          {/* Outer glow ring */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-accent-400 rounded-full opacity-20 blur-xl animate-pulse-slow" />

          {/* Rotating border */}
          <div className="absolute inset-0 rounded-full animate-spin-slow z-20" style={{ animationDuration: '8s' }}>
            <div className="absolute w-3 h-3 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full shadow-glow" style={{ top: '8px', left: '50%', transform: 'translateX(-50%)' }} />
          </div>

          {/* Progress ring */}
          <svg className="absolute inset-2 w-36 h-36 -rotate-90">
            <circle
              cx="72"
              cy="72"
              r="66"
              strokeWidth="6"
              stroke="currentColor"
              fill="none"
              className="text-dark-100"
            />
            <circle
              cx="72"
              cy="72"
              r="66"
              strokeWidth="6"
              stroke="url(#progressGradient2)"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 66}`}
              strokeDashoffset={`${2 * Math.PI * 66 * (1 - generationProgress / 100)}`}
              className="transition-all duration-700 ease-out"
            />
            <defs>
              <linearGradient id="progressGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#486581" />
                <stop offset="100%" stopColor="#44a69c" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent">
              {generationProgress}%
            </span>
            <span className="text-xs text-dark-400 mt-1">{formatTime(elapsedTime)}</span>
          </div>
        </div>

        {/* Stage Indicators */}
        <div className="w-full max-w-xs mb-6">
          <div className="flex items-center justify-between relative">
            {/* Progress line */}
            <div className="absolute top-4 left-8 right-8 h-0.5 bg-dark-100">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500"
                style={{ width: `${(currentStageIndex / (GENERATION_STAGES.length - 1)) * 100}%` }}
              />
            </div>

            {GENERATION_STAGES.map((stage, index) => (
              <div key={stage.id} className="relative flex flex-col items-center z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    index <= currentStageIndex
                      ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-glow'
                      : 'bg-dark-100 text-dark-400'
                  }`}
                >
                  {index < currentStageIndex ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : index === currentStageIndex ? (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1.5 font-medium transition-colors ${
                    index <= currentStageIndex ? 'text-dark-700' : 'text-dark-400'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Current Status */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold text-dark-800 mb-1">
            {GENERATION_STAGES[currentStageIndex]?.description || 'Processing...'}
          </h3>
          <p className="text-sm text-dark-400">
            {currentStageIndex < 3 ? 'This usually takes 1-3 minutes' : 'Almost there!'}
          </p>
        </div>

        {/* Activity Feed */}
        <div className="w-full max-w-xs glass rounded-2xl p-4 border border-white/50 shadow-soft mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-accent-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-dark-600">Live Activity</span>
          </div>
          <div className="space-y-2.5">
            <ActivityItem
              active={currentStageIndex >= 0}
              done={currentStageIndex > 0}
              text="Request received and validated"
            />
            <ActivityItem
              active={currentStageIndex >= 1}
              done={currentStageIndex > 1}
              text="AI generating video scenes"
            />
            <ActivityItem
              active={currentStageIndex >= 2}
              done={currentStageIndex > 2}
              text="Rendering and processing"
            />
          </div>
        </div>

        {/* Info Banner */}
        <div className="w-full max-w-xs bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl p-3 border border-primary-100/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-soft">
              <BellIcon className="w-4 h-4 text-primary-600" />
            </div>
            <p className="text-xs text-dark-600">
              You can close this popup. We'll save your progress!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ active, done, text }: { active: boolean; done: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2.5 transition-opacity ${active ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
        done
          ? 'bg-gradient-to-br from-primary-500 to-accent-500'
          : active
            ? 'bg-dark-200'
            : 'bg-dark-100'
      }`}>
        {done ? (
          <CheckIcon className="w-3 h-3 text-white" />
        ) : active ? (
          <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
        ) : (
          <div className="w-1.5 h-1.5 bg-dark-300 rounded-full" />
        )}
      </div>
      <span className={`text-xs ${done ? 'text-dark-700' : active ? 'text-dark-600' : 'text-dark-400'}`}>
        {text}
      </span>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
