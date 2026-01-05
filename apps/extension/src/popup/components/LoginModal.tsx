import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAVED_CREDENTIALS_KEY = 'aiugcify_saved_credentials';

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { login, register, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_CREDENTIALS_KEY);
      if (saved) {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
        setEmail(savedEmail || '');
        setPassword(savedPassword || '');
        setRememberMe(true);
      }
    } catch {
      // Ignore parsing errors
    }
  }, []);

  // Call onSuccess when authentication succeeds
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      onSuccess();
    }
  }, [isAuthenticated, isOpen, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setValidationError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setValidationError('Password must be at least 8 characters');
        return;
      }
      await register(email, password, name || undefined);
    } else {
      // Save or remove credentials based on rememberMe
      if (rememberMe) {
        localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem(SAVED_CREDENTIALS_KEY);
      }
      await login(email, password);
    }
  };

  const displayError = error || validationError;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-accent-500 p-4 text-center">
          <h2 className="text-lg font-bold text-white">
            {mode === 'login' ? 'Sign in to continue' : 'Create an account'}
          </h2>
          <p className="text-sm text-white/80 mt-1">
            {mode === 'login'
              ? 'Log in to generate your UGC video'
              : 'Sign up to start creating videos'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-dark-700 mb-1">
                Name <span className="text-dark-400">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 bg-dark-50 border border-dark-200 rounded-xl text-dark-800 placeholder-dark-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-dark-700 mb-1">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-dark-50 border border-dark-200 rounded-xl text-dark-800 placeholder-dark-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-700 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder={mode === 'register' ? 'Min. 8 characters' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-dark-50 border border-dark-200 rounded-xl text-dark-800 placeholder-dark-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-dark-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-dark-50 border border-dark-200 rounded-xl text-dark-800 placeholder-dark-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              />
            </div>
          )}

          {mode === 'login' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMeModal"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-dark-300 text-accent-500 focus:ring-accent-500 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="rememberMeModal" className="ml-2 text-sm text-dark-600 cursor-pointer select-none">
                Remember me
              </label>
            </div>
          )}

          {displayError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs text-red-600">{displayError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold rounded-xl shadow-lg shadow-accent-500/20 hover:shadow-xl hover:shadow-accent-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner className="w-4 h-4" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-5 pb-5 text-center">
          <p className="text-sm text-dark-500">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    clearError();
                    setValidationError('');
                  }}
                  className="text-primary-600 font-semibold hover:text-primary-700 transition-colors"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    clearError();
                    setValidationError('');
                  }}
                  className="text-primary-600 font-semibold hover:text-primary-700 transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
