import { useEffect, useState } from 'react';
import { useVideoStore } from '../store/videoStore';
import { useProductStore } from '../store/productStore';
import { useUIStore } from '../store/uiStore';

const GENERATION_STAGES = [
  { id: 'queued', label: 'Queue', tips: ['Warming up...', 'Preparing request...', 'In line...'] },
  { id: 'generating', label: 'Create', tips: ['Sprinkling AI magic...', 'Teaching robots to dance...', 'Making it look effortless...'] },
  { id: 'processing', label: 'Render', tips: ['Polishing to perfection...', 'Adding final touches...', 'Almost there...'] },
];

const TOTAL_DURATION_SECONDS = 300; // 5 minutes

export function GeneratingPage() {
  const { currentVideo, error, pollVideoStatus, isGenerating, reset, clearError } = useVideoStore();
  const { scrapedProduct } = useProductStore();
  const { setPage } = useUIStore();
  const [tipIndex, setTipIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for smooth progress
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => Math.min(prev + 1, TOTAL_DURATION_SECONDS));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBackToDashboard = () => {
    clearError();
    reset();
    setPage('dashboard');
  };

  useEffect(() => {
    if (currentVideo && ['QUEUED', 'GENERATING', 'PROCESSING'].includes(currentVideo.status) && !isGenerating) {
      pollVideoStatus();
    }
  }, [currentVideo, isGenerating, pollVideoStatus]);

  useEffect(() => {
    if (currentVideo?.status === 'COMPLETED') {
      setPage('video-ready');
    }
  }, [currentVideo?.status, setPage]);

  const getCurrentStageIndex = () => {
    if (!currentVideo) return 0;
    switch (currentVideo.status) {
      case 'QUEUED': return 0;
      case 'GENERATING': return 1;
      case 'PROCESSING': return 2;
      case 'COMPLETED': return 3;
      default: return 0;
    }
  };

  const currentStageIndex = getCurrentStageIndex();
  const currentStage = GENERATION_STAGES[currentStageIndex] || GENERATION_STAGES[0];

  // Calculate progress: use the higher of time-based or status-based
  const timeBasedProgress = (elapsedSeconds / TOTAL_DURATION_SECONDS) * 95; // Cap at 95%
  const statusBasedProgress = currentStageIndex === 0 ? 15 : currentStageIndex === 1 ? 50 : currentStageIndex === 2 ? 85 : 100;
  const progressPercent = Math.min(Math.max(timeBasedProgress, statusBasedProgress), 95); // Cap at 95% until complete

  // Rotate tips
  useEffect(() => {
    const tips = currentStage?.tips || [];
    if (tips.length <= 1) return;
    const interval = setInterval(() => setTipIndex((prev) => (prev + 1) % tips.length), 3000);
    return () => clearInterval(interval);
  }, [currentStageIndex, currentStage?.tips]);

  useEffect(() => { setTipIndex(0); }, [currentStageIndex]);

  const currentTip = currentStage?.tips?.[tipIndex] || '';

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[480px] p-6 bg-gradient-to-b from-primary-50 via-slate-50 to-slate-100">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <XIcon className="w-10 h-10 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-dark-800 mb-2">Generation Failed</h3>
        <p className="text-sm text-dark-500 text-center max-w-xs mb-6">{error}</p>
        <button
          onClick={handleBackToDashboard}
          className="px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-[480px] flex flex-col bg-gradient-to-b from-primary-50 via-slate-50 to-slate-100 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary-200/50 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-accent-200/40 rounded-full blur-3xl animate-float-reverse" />
      </div>

      {/* Product Header */}
      {scrapedProduct && (
        <div className="px-4 pt-3 relative z-10">
          <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl shadow-soft border border-dark-100">
            {scrapedProduct.images[0] && (
              <img src={scrapedProduct.images[0]} alt="" className="w-9 h-9 object-cover rounded-lg" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-800 truncate">{scrapedProduct.title}</p>
              <p className="text-[10px] text-dark-400">Generating video...</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Cosmic Forge Animation */}
        <div className="relative mb-6 w-32 h-32">
          {/* Ambient glow background */}
          <div
            className="absolute -inset-6 rounded-full blur-2xl"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(167,139,250,0.2) 40%, transparent 70%)',
              animation: 'pulse 3s ease-in-out infinite',
            }}
          />

          {/* Outer dashed ring - slow reverse rotation */}
          <div
            className="absolute -inset-2"
            style={{ animation: 'spin 15s linear infinite reverse' }}
          >
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="48"
                fill="none"
                stroke="rgba(167,139,250,0.4)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeDasharray="4 8 2 12"
              />
            </svg>
          </div>

          {/* Energy arcs - rotating gradient segments */}
          <div
            className="absolute inset-1"
            style={{ animation: 'spin 10s linear infinite' }}
          >
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="arcGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="50%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d="M 50 8 A 42 42 0 0 1 92 50"
                fill="none"
                stroke="url(#arcGrad1)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 50 92 A 42 42 0 0 1 8 50"
                fill="none"
                stroke="url(#arcGrad1)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.7"
              />
            </svg>
          </div>

          {/* Inner solid ring - faster rotation */}
          <div
            className="absolute inset-3"
            style={{ animation: 'spin 8s linear infinite' }}
          >
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="innerRing" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="50%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#c4b5fd" />
                </linearGradient>
              </defs>
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="url(#innerRing)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="40 20 60 30"
              />
            </svg>
          </div>

          {/* Orbiting particles - different speeds and distances */}
          <div className="absolute inset-0" style={{ animation: 'spin 4s linear infinite' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-violet-400 rounded-full" style={{ boxShadow: '0 0 10px rgba(139,92,246,0.8), 0 0 20px rgba(139,92,246,0.4)' }} />
          </div>
          <div className="absolute inset-1" style={{ animation: 'spin 5s linear infinite reverse' }}>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-300 rounded-full" style={{ boxShadow: '0 0 8px rgba(196,181,253,0.8)' }} />
          </div>
          <div className="absolute inset-2" style={{ animation: 'spin 6s linear infinite' }}>
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 bg-fuchsia-300 rounded-full" style={{ boxShadow: '0 0 6px rgba(240,171,252,0.7)' }} />
          </div>
          <div className="absolute inset-0" style={{ animation: 'spin 7s linear infinite reverse' }}>
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1.5 h-1.5 bg-violet-300 rounded-full" style={{ boxShadow: '0 0 6px rgba(167,139,250,0.7)' }} />
          </div>
          <div className="absolute inset-3" style={{ animation: 'spin 4.5s linear infinite' }}>
            <div className="absolute top-0 right-1/4 w-1 h-1 bg-purple-200 rounded-full" style={{ boxShadow: '0 0 4px rgba(221,214,254,0.8)' }} />
          </div>
          <div className="absolute inset-2" style={{ animation: 'spin 5.5s linear infinite reverse' }}>
            <div className="absolute bottom-1/4 left-0 w-1 h-1 bg-violet-200 rounded-full" style={{ boxShadow: '0 0 4px rgba(196,181,253,0.6)' }} />
          </div>

          {/* Twinkling sparkles */}
          <div
            className="absolute top-1 left-1/4 w-1 h-1 bg-white rounded-full"
            style={{ animation: 'twinkle 2s ease-in-out infinite', boxShadow: '0 0 4px rgba(255,255,255,0.8)' }}
          />
          <div
            className="absolute bottom-2 right-1/4 w-0.5 h-0.5 bg-white rounded-full"
            style={{ animation: 'twinkle 2.5s ease-in-out infinite 0.5s', boxShadow: '0 0 3px rgba(255,255,255,0.6)' }}
          />
          <div
            className="absolute top-1/3 right-1 w-0.5 h-0.5 bg-violet-100 rounded-full"
            style={{ animation: 'twinkle 3s ease-in-out infinite 1s', boxShadow: '0 0 3px rgba(237,233,254,0.7)' }}
          />
          <div
            className="absolute bottom-1/3 left-2 w-0.5 h-0.5 bg-white rounded-full"
            style={{ animation: 'twinkle 2.2s ease-in-out infinite 1.5s', boxShadow: '0 0 3px rgba(255,255,255,0.5)' }}
          />

          {/* Core orb with breathing */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative"
              style={{ animation: 'breathe 3s ease-in-out infinite' }}
            >
              {/* Pulsing glow ring */}
              <div
                className="absolute -inset-4 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(139,92,246,0.2) 40%, transparent 70%)',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              {/* Core sphere */}
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-violet-600 flex items-center justify-center shadow-xl" style={{ boxShadow: '0 0 20px rgba(139,92,246,0.5), 0 4px 15px rgba(124,58,237,0.3)' }}>
                {currentStageIndex === 0 && <QueueIcon className="w-6 h-6 text-white" />}
                {currentStageIndex === 1 && <SparkleIcon className="w-6 h-6 text-white" />}
                {currentStageIndex === 2 && <RenderIcon className="w-6 h-6 text-white" />}
              </div>
            </div>
          </div>
        </div>

        {/* Status Text */}
        <h2 className="text-2xl font-bold text-dark-800 mb-1">
          {currentStageIndex === 0 && 'Queued'}
          {currentStageIndex === 1 && 'Creating'}
          {currentStageIndex === 2 && 'Rendering'}
        </h2>
        <p className="text-sm text-dark-500 mb-6">AI is crafting your video</p>

        {/* Stage Indicators */}
        <div className="flex items-center gap-6 mb-6">
          {GENERATION_STAGES.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-all ${
                index < currentStageIndex ? 'bg-success-500' :
                index === currentStageIndex ? 'bg-gradient-to-r from-primary-500 to-accent-500 animate-pulse' :
                'bg-dark-200'
              }`} />
              <span className={`text-xs font-medium ${
                index <= currentStageIndex ? 'text-dark-700' : 'text-dark-400'
              }`}>
                {stage.label}
              </span>
            </div>
          ))}
        </div>

        {/* Rotating Tip */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-soft border border-dark-100">
          <div className="flex gap-0.5">
            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
            <div className="w-1.5 h-1.5 bg-accent-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
          </div>
          <span key={currentTip} className="text-sm text-dark-600 animate-fade-in">{currentTip}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 relative z-10">
        <div className="flex items-center justify-between px-3 py-2 bg-white rounded-xl shadow-soft border border-dark-100">
          <div className="flex items-center gap-1.5">
            <CloudIcon className="w-3.5 h-3.5 text-dark-400 animate-pulse" />
            <span className="text-[11px] text-dark-500">Processing in background</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('history')}
              className="text-[11px] font-medium text-primary-600 hover:text-primary-500 transition-colors"
            >
              History →
            </button>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-success-100 rounded-full">
              <div className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-medium text-success-600">Saving</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  );
}

function QueueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
    </svg>
  );
}

function RenderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
    </svg>
  );
}
