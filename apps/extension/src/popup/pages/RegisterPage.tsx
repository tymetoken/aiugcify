import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

interface RegisterPageProps {
  onLogin: () => void;
}

export function RegisterPage({ onLogin }: RegisterPageProps) {
  const { register, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const { setPage } = useUIStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  // Redirect to welcome/dashboard after successful registration
  useEffect(() => {
    if (isAuthenticated) {
      setPage('dashboard'); // App.tsx will show welcome page if isFirstLogin is true
    }
  }, [isAuthenticated, setPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

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

    try {
      await register(email, password, name || undefined);
    } catch {
      // Error is already handled in the store
    }
  };

  const displayError = error || validationError;

  return (
    <div className="min-h-[480px] flex flex-col relative overflow-hidden">
      {/* Background gradient - purple to coral matching app theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-500 to-accent-500" />

      {/* Radial overlay for luminous top highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.12)_0%,_transparent_50%)]" />

      {/* Decorative circles - subtle ambient glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-accent-400/15 rounded-full blur-3xl" />

      {/* Close button */}
      <button
        type="button"
        onClick={() => setPage('dashboard')}
        className="absolute top-3 right-3 z-20 p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-full transition-all"
      >
        <CloseIcon className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 z-10">
        {/* Logo - Compact */}
        <div className="animate-fade-in-up mb-4 text-center">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-glow-lg border border-white/20">
            <div className="w-10 h-10 bg-gradient-to-br from-white to-white/80 rounded-xl flex items-center justify-center">
              <span className="gradient-text font-black text-lg">AI</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Create your account</h1>
          <p className="text-white/70 text-xs">Start generating UGC videos today</p>
        </div>

        {/* Register Form */}
        <div className="w-full max-w-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="glass rounded-2xl p-4 shadow-soft-lg">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Name Input */}
              <div>
                <label className="block text-xs font-medium text-dark-700 mb-1">
                  Name <span className="text-dark-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-50 border border-dark-200 rounded-lg text-sm text-dark-800 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                />
              </div>

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
                  placeholder="Create password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-dark-50 border border-dark-200 rounded-lg text-sm text-dark-800 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                />
                <p className="text-[10px] text-dark-400 mt-0.5">
                  Min 8 chars with uppercase, lowercase, number & symbol
                </p>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-xs font-medium text-dark-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-dark-50 border border-dark-200 rounded-lg text-sm text-dark-800 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                />
              </div>

              {/* Error Message */}
              {displayError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg animate-scale-in">
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <AlertIcon className="w-3.5 h-3.5" />
                    {displayError}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-accent-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-accent-500/20 hover:shadow-xl hover:shadow-accent-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner className="w-4 h-4" />
                    Creating account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            {/* Login Link */}
            <p className="text-center text-xs text-dark-500 mt-3">
              Already have an account?{' '}
              <button
                onClick={onLogin}
                className="text-primary-600 font-semibold hover:text-primary-700 transition-colors"
              >
                Sign in
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

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
