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
    <div className="min-h-[480px] flex flex-col relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-800 to-accent-700" />

      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/5 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 z-10">
        {/* Logo */}
        <div className="animate-fade-in-up mb-6 text-center">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-glow-lg border border-white/20">
            <div className="w-14 h-14 bg-gradient-to-br from-white to-white/80 rounded-2xl flex items-center justify-center">
              <span className="gradient-text font-black text-2xl">AI</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to AI UGCify!</h1>
          <p className="text-white/70 mt-1 text-sm">Let's get you started</p>
        </div>

        {/* Credits Card */}
        <div className="w-full max-w-sm animate-fade-in-up mb-6" style={{ animationDelay: '0.1s' }}>
          <div className="glass rounded-2xl p-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CreditIcon className="w-6 h-6 text-accent-500" />
              <span className="text-3xl font-bold text-dark-800">{credits}</span>
            </div>
            <p className="text-sm text-dark-600">
              free credits to get started
            </p>
            <p className="text-xs text-dark-400 mt-1">
              1 credit = 1 video generation
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="w-full max-w-sm animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-white/80 text-sm font-medium text-center mb-4">How it works</p>

          <div className="grid grid-cols-3 gap-3">
            {/* Step 1 */}
            <div className="glass rounded-xl p-3 text-center">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                <SearchIcon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs font-semibold text-dark-700">Browse</p>
              <p className="text-xs text-dark-500 mt-0.5">TikTok Shop</p>
            </div>

            {/* Step 2 */}
            <div className="glass rounded-xl p-3 text-center">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                <VideoIcon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs font-semibold text-dark-700">Generate</p>
              <p className="text-xs text-dark-500 mt-0.5">UGC Video</p>
            </div>

            {/* Step 3 */}
            <div className="glass rounded-xl p-3 text-center">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                <DownloadIcon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs font-semibold text-dark-700">Download</p>
              <p className="text-xs text-dark-500 mt-0.5">& Share</p>
            </div>
          </div>
        </div>

        {/* Get Started Button */}
        <div className="w-full max-w-sm mt-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <button
            onClick={handleGetStarted}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold rounded-xl shadow-lg shadow-accent-500/20 hover:shadow-xl hover:shadow-accent-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Get Started
            <ArrowRightIcon className="w-5 h-5" />
          </button>
        </div>
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M10 9l5 3-5 3V9z" />
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

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
