import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

export function WelcomePage() {
  const { user, setFirstLogin } = useAuthStore();
  const { setPage } = useUIStore();

  const handleGetStarted = () => {
    setFirstLogin(false);
    setPage('dashboard');
  };

  const credits = user?.creditBalance ?? 0;

  return (
    <div className="h-[480px] flex flex-col relative overflow-hidden">
      {/* Background - subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-50 via-slate-50 to-slate-100" />

      {/* Subtle decorative elements with floating animation */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 animate-float-slow" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 animate-float-reverse" />

      {/* Content */}
      <div className="relative flex flex-col h-full px-6 pt-4 pb-8 z-10">
        {/* Header */}
        <div className="text-center mb-3 animate-fade-in-up">
          <div className="relative inline-block mb-1.5">
            <div className="absolute inset-0 bg-primary-200/50 rounded-xl blur-lg scale-125 animate-breathe" />
            <div className="relative w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg border border-primary-100 animate-scale-in">
              <span className="bg-gradient-to-br from-primary-600 to-accent-500 bg-clip-text text-transparent font-black text-base">AI</span>
            </div>
          </div>
          <h1 className="text-lg font-bold text-dark-800">Welcome to AI UGCify!</h1>
          <p className="text-dark-500 text-sm">Create viral videos in seconds</p>
        </div>

        {/* Steps section */}
        <div className="flex-1">
          <p className="text-dark-400 text-xs font-semibold tracking-wider text-center mb-2 uppercase">How it works</p>

          <div className="space-y-2">
            {/* Step 1 */}
            <div className="bg-white rounded-xl p-3 shadow-soft border border-dark-100 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-dark-800 font-semibold text-sm">Browse TikTok Shop</p>
                  <p className="text-dark-400 text-xs">Find trending products</p>
                </div>
                <SearchIcon className="w-5 h-5 text-primary-400" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-xl p-3 shadow-soft border border-dark-100 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-dark-800 font-semibold text-sm">Generate AI Video</p>
                  <p className="text-dark-400 text-xs">One-click UGC creation</p>
                </div>
                <SparklesIcon className="w-5 h-5 text-accent-400" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-xl p-3 shadow-soft border border-dark-100 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-success-500 to-success-600 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <div className="flex-1">
                  <p className="text-dark-800 font-semibold text-sm">Download & Share</p>
                  <p className="text-dark-400 text-xs">Post anywhere instantly</p>
                </div>
                <RocketIcon className="w-5 h-5 text-success-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Credits info - subtle, centered between steps and button */}
        <div className="flex items-center justify-center gap-1.5 py-4 text-dark-500">
          <GiftIcon className="w-4 h-4 text-accent-500" />
          <span className="text-sm">
            <span className="font-bold text-accent-600">{credits}</span> free credits to start
          </span>
        </div>

        {/* CTA Button - primary action */}
        <button
          onClick={handleGetStarted}
          className="relative w-full mb-4 py-5 bg-gradient-to-r from-primary-600 to-accent-500 text-white font-bold text-base rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 overflow-hidden"
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 -translate-x-full animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <span className="relative">Get Started</span>
          <ArrowRightIcon className="relative w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
