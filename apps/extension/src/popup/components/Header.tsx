import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

export function Header() {
  const { user, logout, isAuthenticated, isRefreshingCredits, refreshCredits } = useAuthStore();
  const { currentPage, setPage } = useUIStore();

  return (
    <header className="glass sticky top-0 z-50 px-4 py-3 border-b border-white/20">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage('dashboard')}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-9 h-9 bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500 rounded-xl flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-all group-hover:scale-105">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <span className="font-bold text-dark-800 text-sm">UGCify</span>
        </button>

        <div className="flex items-center gap-1.5">
          {isAuthenticated ? (
            <>
              {user && (
                <button
                  onClick={() => setPage('credits')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    currentPage === 'credits'
                      ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-glow'
                      : 'bg-dark-100 text-dark-700 hover:bg-dark-200'
                  }`}
                >
                  <CoinIcon className="w-4 h-4" />
                  <span>{user.creditBalance}</span>
                </button>
              )}

              <button
                onClick={() => setPage('history')}
                className={`p-2 rounded-xl transition-all ${
                  currentPage === 'history'
                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-glow'
                    : 'text-dark-500 hover:bg-dark-100 hover:text-dark-700'
                }`}
                title="Video History"
              >
                <HistoryIcon className="w-5 h-5" />
              </button>

              <button
                onClick={logout}
                className="p-2 rounded-xl text-dark-400 hover:bg-red-50 hover:text-red-500 transition-all"
                title="Logout"
              >
                <LogoutIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setPage('login')}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-primary-500 to-accent-500 text-white text-sm font-medium rounded-full shadow-glow hover:shadow-glow-lg transition-all hover:scale-105"
            >
              <UserIcon className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8v4l3 3" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
