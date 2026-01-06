import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAVED_CREDENTIALS_KEY = 'aiugcify_saved_credentials';

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { login, register, googleLogin, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    clearError();
    setValidationError('');

    try {
      // Get the extension's redirect URL
      const redirectUrl = chrome.identity.getRedirectURL();

      // Build the Google OAuth URL for ID token
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const nonce = Math.random().toString(36).substring(2);
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUrl);
      authUrl.searchParams.set('response_type', 'id_token');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('nonce', nonce);
      authUrl.searchParams.set('prompt', 'select_account');

      // Launch the auth flow
      const responseUrl = await new Promise<string>((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl.toString(), interactive: true },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response) {
              resolve(response);
            } else {
              reject(new Error('No response from Google'));
            }
          }
        );
      });

      // Extract ID token from the response URL
      const hashParams = new URLSearchParams(responseUrl.split('#')[1]);
      const idToken = hashParams.get('id_token');

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      // Send to backend for verification
      await googleLogin(idToken);
    } catch (err) {
      const message = (err as Error).message;
      if (!message.includes('user cancelled') && !message.includes('canceled')) {
        setValidationError(message || 'Google sign-in failed');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

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
            disabled={isLoading || isGoogleLoading}
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

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-dark-400">or continue with</span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="w-full py-2.5 px-4 bg-white border border-dark-200 text-dark-700 font-medium rounded-xl hover:bg-dark-50 hover:border-dark-300 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {isGoogleLoading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner className="w-4 h-4" />
                Connecting...
              </span>
            ) : (
              <>
                <GoogleIcon className="w-4 h-4" />
                Continue with Google
              </>
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
