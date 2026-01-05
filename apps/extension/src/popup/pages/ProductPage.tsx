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

const VIDEO_STYLES: { value: VideoStyle; label: string; description: string }[] = [
  {
    value: 'PRODUCT_SHOWCASE',
    label: 'Product Showcase',
    description: 'Clean product shots with text overlays',
  },
  {
    value: 'TALKING_HEAD',
    label: 'Talking Head',
    description: 'AI presenter talking about the product',
  },
  {
    value: 'LIFESTYLE',
    label: 'Lifestyle',
    description: 'Product in real-life usage scenarios',
  },
];

export function ProductPage() {
  const { scrapedProduct } = useProductStore();
  const { selectedStyle, setSelectedStyle, generateScript, isLoading, additionalNotes, setAdditionalNotes } = useVideoStore();
  const { isAuthenticated } = useAuthStore();
  const { setPage } = useUIStore();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Simulate step progression while generating
  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0);
      return;
    }

    // Step 1 immediately
    setCurrentStep(1);

    // Step 2 after 2 seconds
    const timer1 = setTimeout(() => setCurrentStep(2), 2000);

    // Step 3 after 5 seconds
    const timer2 = setTimeout(() => setCurrentStep(3), 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isGenerating]);

  const handleGenerateScript = async () => {
    if (!scrapedProduct) return;

    // Show login modal if not authenticated
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    setIsGenerating(true);
    try {
      await generateScript(scrapedProduct, additionalNotes || undefined);
      setPage('script-editor');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoginSuccess = async () => {
    setShowLoginModal(false);
    // Proceed with script generation after successful login
    if (scrapedProduct) {
      setIsGenerating(true);
      try {
        await generateScript(scrapedProduct, additionalNotes || undefined);
        setPage('script-editor');
      } finally {
        setIsGenerating(false);
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
        <h4 className="text-sm font-medium text-slate-700 mb-3">Choose Video Style</h4>
        <div className="space-y-2">
          {VIDEO_STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => setSelectedStyle(style.value)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                selectedStyle === style.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className={`font-medium ${
                      selectedStyle === style.value ? 'text-primary-700' : 'text-slate-800'
                    }`}
                  >
                    {style.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{style.description}</p>
                </div>
                {selectedStyle === style.value && (
                  <CheckCircleIcon className="w-5 h-5 text-primary-500" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-slate-700">Additional Notes</h4>
          <span className={`text-xs ${additionalNotes.length > MAX_NOTES_LENGTH * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
            {additionalNotes.length}/{MAX_NOTES_LENGTH}
          </span>
        </div>
        <div className="relative">
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
            placeholder="Add any specific instructions, features to highlight, or creative direction for your video..."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            rows={3}
            spellCheck={false}
          />
          <div className="absolute bottom-2 right-2">
            <NoteIcon className="w-4 h-4 text-slate-300" />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          Optional: Guide the AI with specific requests for your video script
        </p>
      </div>

      {/* Credit Tooltip for first-time users */}
      <CreditTooltip className="mb-2" />

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
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ top: '-100px', bottom: '-100px', left: '-100px', right: '-100px' }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Progress Card */}
          <div className="relative w-[calc(100%-48px)] max-w-[320px] bg-white rounded-2xl shadow-xl animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-accent-500 p-5 text-center">
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
                      currentStep >= step.id
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white'
                        : 'bg-dark-100 text-dark-400'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <CheckIcon className="w-4 h-4" />
                    ) : currentStep === step.id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-xs font-medium">{step.id}</span>
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <p
                      className={`text-sm font-medium transition-colors ${
                        currentStep >= step.id ? 'text-dark-800' : 'text-dark-400'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className={`text-xs transition-colors ${
                        currentStep >= step.id ? 'text-dark-500' : 'text-dark-300'
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
                  style={{ width: `${(currentStep / GENERATION_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
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

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
