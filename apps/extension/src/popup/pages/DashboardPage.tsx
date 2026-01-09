import { useEffect, useRef, useState } from 'react';
import { useProductStore } from '../store/productStore';
import { useUIStore } from '../store/uiStore';
import { useVideoStore } from '../store/videoStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { UpgradeModal } from '../components/UpgradeModal';
import { LoginModal } from '../components/LoginModal';

export function DashboardPage() {
  const { isOnProductPage, scrapedProduct, scrapeCurrentPage, isLoading } = useProductStore();
  const { setPage } = useUIStore();
  const { setAdditionalNotes, reset: resetVideoStore } = useVideoStore();
  const { user, isAuthenticated } = useAuthStore();
  const previousProductUrl = useRef<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const hasCredits = (user?.creditBalance ?? 0) > 0;

  // Clear additional notes when product URL changes (different product)
  useEffect(() => {
    const currentUrl = scrapedProduct?.url || null;
    if (previousProductUrl.current !== null && currentUrl !== previousProductUrl.current) {
      setAdditionalNotes('');
    }
    previousProductUrl.current = currentUrl;
  }, [scrapedProduct?.url, setAdditionalNotes]);

  const handleStartGeneration = async () => {
    // Check if user is authenticated first
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    // Check if user has credits
    if (!hasCredits) {
      setShowUpgradeModal(true);
      return;
    }

    // Clear old video/script state when starting fresh generation
    resetVideoStore();

    if (!scrapedProduct) {
      await scrapeCurrentPage();
    }
    setPage('product');
  };

  const handleLoginSuccess = async () => {
    setShowLoginModal(false);
    // After login, continue with generation flow
    // The user state will be updated, so we check credits again
    if (!scrapedProduct) {
      await scrapeCurrentPage();
    }
    setPage('product');
  };

  return (
    <div className="px-4 py-3 space-y-3 animate-fade-in min-h-full flex flex-col">
      {/* Status Card */}
      <div
        className={`rounded-xl p-3 transition-all duration-300 ${
          isOnProductPage
            ? 'bg-success-50/80 border border-success-200/50'
            : 'bg-white border border-dark-200/50 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              isOnProductPage
                ? 'bg-success-500 shadow-sm'
                : 'bg-dark-100'
            }`}
          >
            {isOnProductPage ? (
              <CheckIcon className="w-5 h-5 text-white animate-scale-in" />
            ) : (
              <SearchIcon className="w-4 h-4 text-dark-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3
                className={`font-semibold text-sm ${
                  isOnProductPage ? 'text-success-700' : 'text-dark-700'
                }`}
              >
                {isOnProductPage ? 'Product Detected!' : 'Find a Product'}
              </h3>
              {isOnProductPage && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-success-100 text-success-600">
                  Ready
                </span>
              )}
            </div>
            <p className={`text-xs ${isOnProductPage ? 'text-success-600/70' : 'text-dark-500'}`}>
              {isOnProductPage
                ? 'Ready to generate a UGC video'
                : 'Navigate to any TikTok Shop product page'}
            </p>
          </div>
        </div>
      </div>

      {/* Product Preview */}
      {scrapedProduct && (
        <div className="animate-fade-in-up rounded-xl bg-white border border-dark-200/50 shadow-sm overflow-hidden">
          {/* Header with label and refresh */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/50 border-b border-dark-100/50">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
              <span className="text-[11px] font-medium text-dark-500 uppercase tracking-wide">Selected Product</span>
            </div>
            <button
              onClick={scrapeCurrentPage}
              disabled={isLoading}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-dark-400 hover:text-primary-600 hover:bg-white rounded transition-colors disabled:opacity-50"
              title="Refresh product data"
            >
              <RefreshIcon className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Product Content */}
          <div className="p-3">
            <div className="flex gap-3">
              {/* Product Image */}
              {scrapedProduct.images[0] && (
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 shadow-sm">
                    <img
                      src={scrapedProduct.images[0]}
                      alt={scrapedProduct.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {scrapedProduct.discount && (
                    <div className="absolute -top-1 -right-1 px-1 py-0.5 bg-accent-500 text-white text-[9px] font-bold rounded shadow-sm">
                      {scrapedProduct.discount.replace('off', '').replace(/\s+/g, '').trim()}
                    </div>
                  )}
                </div>
              )}

              {/* Product Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <h4 className="font-semibold text-dark-800 text-xs line-clamp-2 leading-snug">
                  {scrapedProduct.title}
                </h4>

                <div className="mt-1.5 space-y-1">
                  {/* Price Row */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-dark-900">
                      {scrapedProduct.price}
                    </span>
                    {scrapedProduct.originalPrice && scrapedProduct.originalPrice !== scrapedProduct.price && (
                      <span className="text-xs text-dark-400 line-through">
                        {scrapedProduct.originalPrice}
                      </span>
                    )}
                  </div>

                  {/* Rating Row */}
                  {scrapedProduct.rating && (
                    <div className="flex items-center gap-1">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`w-3 h-3 ${
                              i < Math.floor(parseFloat(String(scrapedProduct.rating || '0')))
                                ? 'text-warning-400 fill-warning-400'
                                : 'text-dark-200 fill-dark-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-medium text-dark-500">{scrapedProduct.rating}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Credits Notice */}
      {isAuthenticated && !hasCredits && (
        <div className="rounded-lg bg-warning-50/80 border border-warning-200/50 px-2.5 py-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-warning-500 rounded-md flex items-center justify-center flex-shrink-0">
              <CreditEmptyIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-dark-800 text-xs">Out of Credits</p>
              <p className="text-[11px] text-dark-500">Upgrade to continue creating</p>
            </div>
            <button
              onClick={() => setPage('credits')}
              className="flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700 transition-colors whitespace-nowrap"
            >
              <span>View plans</span>
              <ArrowRightIcon className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleStartGeneration}
        className={`w-full ${
          isAuthenticated && !hasCredits
            ? 'bg-warning-500 hover:bg-warning-600'
            : ''
        }`}
        size="lg"
        disabled={!isOnProductPage}
        isLoading={isLoading}
      >
        <span className="flex items-center gap-2">
          {!isAuthenticated ? (
            <>
              <SparkleIcon className="w-5 h-5" />
              {scrapedProduct ? 'Generate UGC Video' : 'Scrape & Generate'}
            </>
          ) : hasCredits ? (
            <>
              <SparkleIcon className="w-5 h-5" />
              {scrapedProduct ? 'Generate UGC Video' : 'Scrape & Generate'}
            </>
          ) : (
            <>
              <UpgradeIcon className="w-5 h-5" />
              Upgrade to Generate
            </>
          )}
        </span>
      </Button>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2.5 mt-auto">
        <button
          onClick={() => setPage('history')}
          className="group rounded-xl p-3 text-left bg-white border border-dark-200/50 hover:border-primary-300 shadow-sm hover:shadow transition-all"
        >
          <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center mb-2 group-hover:bg-primary-100 transition-colors">
            <VideoIcon className="w-4.5 h-4.5 text-primary-600" />
          </div>
          <p className="text-sm font-semibold text-dark-800">My Videos</p>
          <p className="text-[11px] text-dark-400">View history</p>
        </button>

        <button
          onClick={() => setPage('credits')}
          className="group rounded-xl p-3 text-left bg-white border border-dark-200/50 hover:border-accent-300 shadow-sm hover:shadow transition-all"
        >
          <div className="w-9 h-9 bg-accent-50 rounded-lg flex items-center justify-center mb-2 group-hover:bg-accent-100 transition-colors">
            <CreditIcon className="w-4.5 h-4.5 text-accent-600" />
          </div>
          <p className="text-sm font-semibold text-dark-800">Credits</p>
          <p className="text-[11px] text-dark-400">Plans & pricing</p>
        </button>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Upgrade Modal */}
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
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

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CreditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function UpgradeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function CreditEmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
