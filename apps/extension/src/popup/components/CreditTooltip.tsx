import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

const TOOLTIP_SEEN_KEY = 'aiugcify_credit_tooltip_seen';

interface CreditTooltipProps {
  className?: string;
}

export function CreditTooltip({ className = '' }: CreditTooltipProps) {
  const { user } = useAuthStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has seen the tooltip before
    const hasSeen = localStorage.getItem(TOOLTIP_SEEN_KEY);
    if (!hasSeen) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(TOOLTIP_SEEN_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const credits = user?.creditBalance ?? 0;

  return (
    <div className={`relative ${className}`}>
      {/* Tooltip arrow */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-accent-500" />

      {/* Tooltip content */}
      <div className="bg-gradient-to-r from-primary-700 to-accent-600 rounded-xl p-4 shadow-lg animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <CreditIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              This will use 1 credit
            </p>
            <p className="text-xs text-white/80 mt-0.5">
              You have {credits} credit{credits !== 1 ? 's' : ''} remaining
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="mt-3 w-full py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function CreditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M9 9h6M9 15h6" />
    </svg>
  );
}
