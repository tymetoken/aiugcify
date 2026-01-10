import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Only store email for convenience - NEVER store passwords
const SAVED_EMAIL_KEY = 'aiugcify_saved_email';

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { login, register, googleLogin, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Load saved email on mount (never passwords)
  useEffect(() => {
    // Clear any legacy credentials that stored passwords
    localStorage.removeItem('aiugcify_saved_credentials');

    try {
      const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    } catch {
      // Ignore errors
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
      // Use cryptographically secure random nonce
      const nonceArray = new Uint8Array(32);
      crypto.getRandomValues(nonceArray);
      const nonce = Array.from(nonceArray, b => b.toString(16).padStart(2, '0')).join('');
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
      // Validate password strength
      if (password.length < 8) {
        setValidationError('Password must be at least 8 characters');
        return;
      }
      if (password.length > 128) {
        setValidationError('Password must not exceed 128 characters');
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setValidationError('Password must contain an uppercase letter');
        return;
      }
      if (!/[a-z]/.test(password)) {
        setValidationError('Password must contain a lowercase letter');
        return;
      }
      if (!/[0-9]/.test(password)) {
        setValidationError('Password must contain a number');
        return;
      }
      if (!/[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\\/`~]/.test(password)) {
        setValidationError('Password must contain a special character');
        return;
      }
      await register(email, password, name || undefined);
    } else {
      // Save or remove email based on rememberEmail (never save passwords)
      if (rememberEmail) {
        localStorage.setItem(SAVED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
      }
      await login(email, password);
    }
  };

  const displayError = error || validationError;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-[calc(100%-16px)] max-w-[340px] mx-2 bg-white rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
        {/* Header with App Theme Gradient */}
        <div className="relative bg-gradient-to-r from-primary-600 to-accent-500 px-4 py-3 overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full blur-2xl" />

          <div className="relative text-center">
            <h2 className="text-base font-bold text-white">
              {mode === 'login' ? 'Welcome back' : 'Get started'}
            </h2>
            <p className="text-xs text-white/80 mt-0.5">
              {mode === 'login'
                ? 'Sign in to create your video'
                : 'Create your free account'}
            </p>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2.5 right-2.5 p-1 text-white/70 hover:text-white hover:bg-white/15 rounded-full transition-all"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 space-y-2">
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-dark-600 uppercase tracking-wide">
                Name <span className="text-dark-400 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 bg-dark-50 border border-dark-200 rounded-lg text-dark-800 placeholder-dark-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 focus:bg-white transition-all"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-dark-600 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-1.5 bg-dark-50 border border-dark-200 rounded-lg text-dark-800 placeholder-dark-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-dark-600 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              placeholder={mode === 'register' ? 'Create password' : 'Your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-1.5 bg-dark-50 border border-dark-200 rounded-lg text-dark-800 placeholder-dark-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 focus:bg-white transition-all"
            />
            {mode === 'register' && (
              <p className="text-[10px] text-dark-400 mt-0.5">
                Min 8 chars • uppercase • lowercase • number • symbol
              </p>
            )}
          </div>

          {mode === 'register' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-dark-600 uppercase tracking-wide">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-dark-50 border border-dark-200 rounded-lg text-dark-800 placeholder-dark-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 focus:bg-white transition-all"
              />
            </div>
          )}

          {mode === 'login' && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="w-4 h-4 rounded-md border-dark-300 text-primary-600 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer transition-colors"
              />
              <span className="text-[13px] text-dark-500 group-hover:text-dark-700 transition-colors select-none">
                Remember my email
              </span>
            </label>
          )}

          {displayError && (
            <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded-lg">
              <svg className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-600 leading-tight">{displayError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full py-2 px-4 bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold rounded-xl shadow-lg shadow-accent-500/20 hover:shadow-xl hover:shadow-accent-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm"
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
          <div className="relative py-0.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-[10px] text-dark-400 uppercase tracking-wider">or</span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="w-full py-2 px-4 bg-white border border-dark-200 text-dark-700 font-medium rounded-xl hover:bg-dark-50 hover:border-dark-300 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {isGoogleLoading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner className="w-4 h-4" />
                Connecting...
              </span>
            ) : (
              <>
                <GoogleIcon className="w-[18px] h-[18px]" />
                Continue with Google
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-3 pb-2.5 text-center border-t border-dark-100 pt-2 bg-dark-50/50">
          <p className="text-xs text-dark-500">
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
