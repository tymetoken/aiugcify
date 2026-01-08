import { useState, useEffect } from 'react';
import { useProductStore } from '../store/productStore';
import { useVideoStore } from '../store/videoStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { Button } from '../components/Button';
import { CreditTooltip } from '../components/CreditTooltip';
import { LoginModal } from '../components/LoginModal';
import type { VideoStyle } from '@aiugcify/shared-types';

const MAX_NOTES_LENGTH = 500;

const GENERATION_STEPS = [
  { id: 1, label: 'Analyzing product', description: 'Extracting key features and benefits' },
  { id: 2, label: 'Creating script', description: 'Generating compelling video script' },
  { id: 3, label: 'Finalizing', description: 'Preparing your script for review' },
];

const VIDEO_STYLES: { value: VideoStyle; label: string; description: string; icon: string; badge?: string }[] = [
  {
    value: 'PRODUCT_SHOWCASE',
    label: 'Product Showcase',
    description: 'Cinematic product shots with text overlays',
    icon: '🎬',
    badge: 'Popular',
  },
  {
    value: 'TALKING_HEAD',
    label: 'Talking Head',
    description: 'AI presenter reviews your product',
    icon: '🗣️',
  },
  {
    value: 'LIFESTYLE',
    label: 'Lifestyle',
    description: 'Product in real-world scenarios',
    icon: '✨',
  },
];

export function ProductPage() {
  const { scrapedProduct } = useProductStore();
  const {
    selectedStyle,
    setSelectedStyle,
    generateScript,
    isLoading,
    additionalNotes,
    setAdditionalNotes,
    isGeneratingScript,
    scriptGenerationStep,
    currentScript,
    error,
    clearError,
  } = useVideoStore();
  const { isAuthenticated } = useAuthStore();
  const { setPage } = useUIStore();

  const [showLoginModal, setShowLoginModal] = useState(false);

  // Navigate to script-editor when script is ready
  useEffect(() => {
    if (currentScript && !isGeneratingScript) {
      setPage('script-editor');
    }
  }, [currentScript, isGeneratingScript, setPage]);

  const handleGenerateScript = async () => {
    if (!scrapedProduct) return;

    // Show login modal if not authenticated
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    try {
      await generateScript(scrapedProduct, additionalNotes || undefined);
      // Navigation is handled by the useEffect above when currentScript is set
    } catch {
      // Error is handled in the store
    }
  };

  const handleLoginSuccess = async () => {
    setShowLoginModal(false);
    // Proceed with script generation after successful login
    if (scrapedProduct) {
      try {
        await generateScript(scrapedProduct, additionalNotes || undefined);
        // Navigation is handled by the useEffect above when currentScript is set
      } catch {
        // Error is handled in the store
      }
    }
  };

  if (!scrapedProduct) {
    return (
      <div className="p-4 text-center">
        <p className="text-slate-500">No product data available</p>
        <Button onClick={() => setPage('dashboard')} variant="secondary" className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Product Preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex gap-3">
          {scrapedProduct.images[0] && (
            <img
              src={scrapedProduct.images[0]}
              alt={scrapedProduct.title}
              className="w-24 h-24 object-cover rounded-lg"
            />
          )}
          <div className="flex-1">
            <h3 className="font-medium text-slate-800 text-sm line-clamp-2">
              {scrapedProduct.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-primary-600 font-bold text-lg">{scrapedProduct.price}</p>
              {scrapedProduct.originalPrice && scrapedProduct.originalPrice !== scrapedProduct.price && (
                <p className="text-sm text-slate-400 line-through">
                  {scrapedProduct.originalPrice}
                </p>
              )}
            </div>
            {scrapedProduct.discount && (
              <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-sm mt-1">
                -{scrapedProduct.discount.replace('off', '').trim()}
              </span>
            )}
            {scrapedProduct.shopName && (
              <p className="text-xs text-slate-500 mt-1">by {scrapedProduct.shopName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Video Style Selection */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Video Style</h4>
        <div className="grid grid-cols-3 gap-2">
          {VIDEO_STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => setSelectedStyle(style.value)}
              className={`relative p-3 rounded-xl text-center transition-all duration-200 ${
                selectedStyle === style.value
                  ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-lg shadow-primary-500/30 scale-[1.02]'
                  : 'bg-white border border-slate-200 hover:border-primary-300 hover:shadow-md'
              }`}
            >
              {style.badge && (
                <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  selectedStyle === style.value
                    ? 'bg-white text-primary-600'
                    : 'bg-amber-400 text-amber-900'
                }`}>
                  {style.badge}
                </span>
              )}
              <div className="text-2xl mb-1">{style.icon}</div>
              <p className={`text-xs font-semibold ${
                selectedStyle === style.value ? 'text-white' : 'text-slate-700'
              }`}>
                {style.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Script Direction</h4>
          <span className={`text-xs ${additionalNotes.length > MAX_NOTES_LENGTH * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
            {additionalNotes.length}/{MAX_NOTES_LENGTH}
          </span>
        </div>
        <div className="relative">
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
            placeholder="Add specific instructions, features to highlight, or creative direction..."
            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            rows={2}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Credit Tooltip for first-time users */}
      <CreditTooltip className="mb-2" />

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Script Generation Failed</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="space-y-2">
        <Button
          onClick={handleGenerateScript}
          className="w-full"
          size="lg"
          isLoading={isLoading}
        >
          Generate Script (1 Credit)
        </Button>
        <Button
          onClick={() => setPage('dashboard')}
          variant="ghost"
          className="w-full"
        >
          Cancel
        </Button>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Script Generation Progress Overlay */}
      {isGeneratingScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ top: '-100px', bottom: '-100px', left: '-100px', right: '-100px' }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Progress Card */}
          <div className="relative w-[calc(100%-48px)] max-w-[320px] bg-white rounded-2xl shadow-xl animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-accent-500 p-5 text-center relative">
              {/* Cancel button */}
              <button
                onClick={() => {
                  useVideoStore.getState().reset();
                  setPage('dashboard');
                }}
                className="absolute top-3 right-3 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                title="Cancel"
              >
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 animate-pulse-slow">
                <SparklesIcon className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">Generating Script</h2>
              <p className="text-sm text-white/80 mt-1">AI is creating your video script</p>
            </div>

            {/* Steps */}
            <div className="p-5 space-y-4">
              {GENERATION_STEPS.map((step) => (
                <div key={step.id} className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      scriptGenerationStep >= step.id
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white'
                        : 'bg-dark-100 text-dark-400'
                    }`}
                  >
                    {scriptGenerationStep > step.id ? (
                      <CheckIcon className="w-4 h-4" />
                    ) : scriptGenerationStep === step.id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-xs font-medium">{step.id}</span>
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <p
                      className={`text-sm font-medium transition-colors ${
                        scriptGenerationStep >= step.id ? 'text-dark-800' : 'text-dark-400'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className={`text-xs transition-colors ${
                        scriptGenerationStep >= step.id ? 'text-dark-500' : 'text-dark-300'
                      }`}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="px-5 pb-5">
              <div className="h-2 bg-dark-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500"
                  style={{ width: `${(scriptGenerationStep / GENERATION_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3L14.5 8.5L20 11L14.5 13.5L12 19L9.5 13.5L4 11L9.5 8.5L12 3Z" />
      <path d="M19 3L20 5L22 6L20 7L19 9L18 7L16 6L18 5L19 3Z" />
      <path d="M5 19L6 21L8 22L6 23L5 25L4 23L2 22L4 21L5 19Z" />
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
