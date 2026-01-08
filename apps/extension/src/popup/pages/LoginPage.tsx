import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

interface LoginPageProps {
  onRegister: () => void;
}

const SAVED_CREDENTIALS_KEY = 'aiugcify_saved_credentials';

export function LoginPage({ onRegister }: LoginPageProps) {
  const { login, googleLogin, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const { setPage } = useUIStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

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

  // Redirect to dashboard after successful login
  useEffect(() => {
    if (isAuthenticated) {
      setPage('dashboard');
    }
  }, [isAuthenticated, setPage]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    clearError();
    setGoogleError('');

    try {
      const redirectUrl = chrome.identity.getRedirectURL();
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const nonce = Math.random().toString(36).substring(2);
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUrl);
      authUrl.searchParams.set('response_type', 'id_token');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('nonce', nonce);
      authUrl.searchParams.set('prompt', 'select_account');

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

      const hashParams = new URLSearchParams(responseUrl.split('#')[1]);
      const idToken = hashParams.get('id_token');

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      await googleLogin(idToken);
    } catch (err) {
      const message = (err as Error).message;
      if (!message.includes('user cancelled') && !message.includes('canceled')) {
        setGoogleError(message || 'Google sign-in failed');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setGoogleError('');

    // Save or remove credentials based on rememberMe
    if (rememberMe) {
      localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem(SAVED_CREDENTIALS_KEY);
    }

    try {
      await login(email, password);
    } catch {
      // Error is already handled in the store
    }
  };

  return (
    <div className="min-h-[480px] flex flex-col relative overflow-hidden">
      {/* Background gradient - subtle slate to teal */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900" />

      {/* Decorative circles - subtle and refined */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent-400/10 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4 z-10">
        {/* Logo - Compact */}
        <div className="animate-fade-in-up mb-4 text-center">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-glow-lg border border-white/20">
            <div className="w-10 h-10 bg-gradient-to-br from-white to-white/80 rounded-xl flex items-center justify-center">
              <span className="gradient-text font-black text-lg">AI</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Sign in to continue</h1>
          <p className="text-white/70 text-xs">Log in to generate your UGC video</p>
        </div>

        {/* Login Form */}
        <div className="w-full max-w-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="glass rounded-2xl p-4 shadow-soft-lg">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email Input */}
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
                  className="w-full px-3 py-2 bg-dark-50 border border-dark-200 rounded-lg text-sm text-dark-800 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-medium text-dark-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-dark-50 border border-dark-200 rounded-lg text-sm text-dark-800 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                />
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-dark-300 text-accent-500 focus:ring-accent-500 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="ml-2 text-xs text-dark-600 cursor-pointer select-none">
                  Remember me
                </label>
              </div>

              {/* Error Message */}
              {(error || googleError) && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg animate-scale-in">
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <AlertIcon className="w-3.5 h-3.5" />
                    {error || googleError}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-accent-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-accent-500/20 hover:shadow-xl hover:shadow-accent-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner className="w-4 h-4" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-dark-200" />
              <span className="text-xs text-dark-400">or continue with</span>
              <div className="flex-1 h-px bg-dark-200" />
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
              className="w-full py-2.5 px-4 bg-white border border-dark-200 text-dark-700 text-sm font-medium rounded-lg hover:bg-dark-50 hover:border-dark-300 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

            {/* Register Link */}
            <p className="text-center text-xs text-dark-500 mt-3">
              Don&apos;t have an account?{' '}
              <button
                onClick={onRegister}
                className="text-primary-600 font-semibold hover:text-primary-700 transition-colors"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
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
