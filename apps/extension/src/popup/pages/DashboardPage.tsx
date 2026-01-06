import { useEffect, useRef, useState } from 'react';
import { useProductStore } from '../store/productStore';
import { useUIStore } from '../store/uiStore';
import { useVideoStore } from '../store/videoStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { UpgradeModal } from '../components/UpgradeModal';

export function DashboardPage() {
  const { isOnProductPage, scrapedProduct, scrapeCurrentPage, isLoading } = useProductStore();
  const { setPage } = useUIStore();
  const { setAdditionalNotes } = useVideoStore();
  const { user } = useAuthStore();
  const previousProductUrl = useRef<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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
    // Check if user has credits
    if (!hasCredits) {
      setShowUpgradeModal(true);
      return;
    }

    // Clear notes when starting fresh generation
    setAdditionalNotes('');

    if (!scrapedProduct) {
      await scrapeCurrentPage();
    }
    setPage('product');
  };

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Status Card */}
      <div
        className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${
          isOnProductPage
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200'
            : 'glass border border-dark-200'
        }`}
      >
        {isOnProductPage && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        )}
        <div className="relative flex items-start gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              isOnProductPage
                ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-500/30'
                : 'bg-dark-100'
            }`}
          >
            {isOnProductPage ? (
              <CheckIcon className="w-6 h-6 text-white animate-scale-in" />
            ) : (
              <SearchIcon className="w-6 h-6 text-dark-400" />
            )}
          </div>
          <div className="flex-1">
            <h3
              className={`font-bold text-lg ${
                isOnProductPage ? 'text-green-800' : 'text-dark-700'
              }`}
            >
              {isOnProductPage ? 'Product Detected!' : 'Find a Product'}
            </h3>
            <p className={`text-sm mt-0.5 ${isOnProductPage ? 'text-green-600' : 'text-dark-500'}`}>
              {isOnProductPage
                ? 'Ready to generate a UGC video'
                : 'Navigate to any TikTok Shop product page'}
            </p>
          </div>
        </div>
      </div>

      {/* Product Preview */}
      {scrapedProduct && (
        <div className="relative overflow-hidden rounded-2xl animate-fade-in-up bg-white border border-dark-100 shadow-sm">
          {/* Header with label and refresh */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-dark-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
              <span className="text-xs font-semibold text-dark-600 uppercase tracking-wide">Selected Product</span>
            </div>
            <button
              onClick={scrapeCurrentPage}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-dark-400 hover:text-primary-600 hover:bg-white rounded-md transition-all disabled:opacity-50"
              title="Refresh product data"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Product Content */}
          <div className="p-4">
            <div className="flex gap-4">
              {/* Product Image */}
              {scrapedProduct.images[0] && (
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shadow-sm">
                    <img
                      src={scrapedProduct.images[0]}
                      alt={scrapedProduct.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {scrapedProduct.discount && (
                    <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold rounded-md shadow-sm">
                      {scrapedProduct.discount.replace('off', '').replace(/\s+/g, '').trim()}
                    </div>
                  )}
                </div>
              )}

              {/* Product Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <h4 className="font-semibold text-dark-800 text-sm line-clamp-2 leading-snug">
                  {scrapedProduct.title}
                </h4>

                <div className="mt-2 space-y-1.5">
                  {/* Price Row */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-dark-900">
                      {scrapedProduct.price}
                    </span>
                    {scrapedProduct.originalPrice && scrapedProduct.originalPrice !== scrapedProduct.price && (
                      <span className="text-sm text-dark-400 line-through">
                        {scrapedProduct.originalPrice}
                      </span>
                    )}
                  </div>

                  {/* Rating Row */}
                  {scrapedProduct.rating && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < Math.floor(parseFloat(String(scrapedProduct.rating || '0')))
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-dark-200 fill-dark-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-dark-500">{scrapedProduct.rating}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Credits Warning */}
      {!hasCredits && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <WarningIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-800">No credits remaining</p>
              <p className="text-sm text-amber-600 mt-0.5">
                You've used your free videos. Upgrade to continue creating.
              </p>
              <button
                onClick={() => setPage('credits')}
                className="mt-2 text-sm font-semibold text-amber-700 hover:text-amber-900 underline"
              >
                View pricing plans
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleStartGeneration}
        className={`w-full ${!hasCredits ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' : ''}`}
        size="lg"
        disabled={!isOnProductPage}
        isLoading={isLoading}
      >
        <span className="flex items-center gap-2">
          {hasCredits ? (
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
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setPage('history')}
          className="group glass rounded-2xl p-4 text-left border border-dark-200/50 hover:border-primary-300 hover:shadow-soft-lg transition-all card-hover"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <VideoIcon className="w-5 h-5 text-primary-600" />
          </div>
          <p className="text-sm font-semibold text-dark-800">My Videos</p>
          <p className="text-xs text-dark-400 mt-0.5">View history</p>
        </button>

        <button
          onClick={() => setPage('credits')}
          className="group glass rounded-2xl p-4 text-left border border-dark-200/50 hover:border-accent-300 hover:shadow-soft-lg transition-all card-hover"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-accent-100 to-accent-200 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <CreditIcon className="w-5 h-5 text-accent-600" />
          </div>
          <p className="text-sm font-semibold text-dark-800">Buy Credits</p>
          <p className="text-xs text-dark-400 mt-0.5">Get more videos</p>
        </button>
      </div>

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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <path d="M10 8l6 4-6 4V8z" />
    </svg>
  );
}

function CreditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8M12 18V6" />
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

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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
