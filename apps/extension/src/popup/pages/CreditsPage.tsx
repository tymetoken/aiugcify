import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { apiClient } from '@/shared/api-client';
import { Button } from '../components/Button';
import { LoginModal } from '../components/LoginModal';
import type { CreditPackage, SubscriptionPlan, UserSubscription } from '@aiugcify/shared-types';

export function CreditsPage() {
  const { refreshUser, isAuthenticated } = useAuthStore();
  const { setPage } = useUIStore();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [showOneTime, setShowOneTime] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [packagesRes, plansRes] = await Promise.all([
        apiClient.getPackages(),
        apiClient.getSubscriptionPlans(),
      ]);
      setPackages(packagesRes.packages);
      setSubscriptionPlans(plansRes.plans);

      // Only load subscription status if authenticated
      if (isAuthenticated) {
        try {
          const subscriptionRes = await apiClient.getSubscriptionStatus();
          setSubscription(subscriptionRes.subscription);
        } catch {
          setSubscription(null);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setIsLoading(false);
  };

  const handleSubscribe = async (planId: string) => {
    console.log('handleSubscribe called with planId:', planId);
    console.log('isAuthenticated:', isAuthenticated);
    console.log('billingInterval:', billingInterval);

    if (!isAuthenticated) {
      console.log('User not authenticated, showing login modal');
      setShowLoginModal(true);
      return;
    }
    setPurchasingId(planId);
    try {
      console.log('Calling createSubscriptionCheckout...');
      const response = await apiClient.createSubscriptionCheckout(planId, billingInterval);
      console.log('Checkout response:', response);
      const { checkoutUrl } = response;
      console.log('Opening checkout URL:', checkoutUrl);
      if (checkoutUrl) {
        chrome.tabs.create({ url: checkoutUrl });
      } else {
        console.error('No checkoutUrl in response');
      }
      setTimeout(() => {
        refreshUser();
        loadData();
      }, 5000);
    } catch (error) {
      console.error('Failed to create checkout:', error);
      alert('Failed to create checkout: ' + (error as Error).message);
    }
    setPurchasingId(null);
  };

  const handlePurchase = async (packageId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setPurchasingId(packageId);
    try {
      const { checkoutUrl } = await apiClient.createCheckout(packageId);
      window.open(checkoutUrl, '_blank');
      setTimeout(() => refreshUser(), 5000);
    } catch (error) {
      console.error('Failed to create checkout:', error);
    }
    setPurchasingId(null);
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Cancel subscription? You\'ll keep access until the billing period ends.')) return;
    setPurchasingId('cancel');
    try {
      await apiClient.cancelSubscription(true);
      await loadData();
    } catch (error) {
      console.error('Failed to cancel:', error);
    }
    setPurchasingId(null);
  };

  // Calculate price per video
  const getPricePerVideo = (plan: SubscriptionPlan, isYearly: boolean) => {
    const totalPrice = isYearly ? plan.yearlyPriceInCents : plan.monthlyPriceInCents * 12;
    const totalVideos = isYearly
      ? plan.yearlyCredits + plan.yearlyBonusCredits
      : plan.monthlyCredits * 12;
    return (totalPrice / 100 / totalVideos).toFixed(2);
  };

  // Calculate yearly savings
  const getYearlySavings = (plan: SubscriptionPlan) => {
    const monthlyTotal = plan.monthlyPriceInCents * 12;
    const yearlyTotal = plan.yearlyPriceInCents;
    return Math.round((monthlyTotal - yearlyTotal) / 100);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 space-y-4">
        <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const isCurrentPlan = (planId: string) =>
    subscription?.plan.id === planId && subscription?.status === 'ACTIVE';

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">Choose Your Plan</h1>
          <p className="text-sm text-slate-500 mb-3">Cancel anytime.</p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-slate-100 rounded-full p-1 shadow-inner">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                billingInterval === 'monthly'
                  ? 'bg-white text-slate-800 shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                billingInterval === 'yearly'
                  ? 'bg-white text-slate-800 shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Yearly
              <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="space-y-4 pt-2">
          {subscriptionPlans.map((plan) => {
            const isYearly = billingInterval === 'yearly';
            const price = isYearly
              ? Math.round(plan.yearlyPriceInCents / 100 / 12)
              : Math.round(plan.monthlyPriceInCents / 100);
            const totalVideos = isYearly
              ? plan.yearlyCredits + plan.yearlyBonusCredits
              : plan.monthlyCredits;
            const isCurrent = isCurrentPlan(plan.id);
            const isPopular = plan.badgeText === 'Most Popular';
            const pricePerVideo = getPricePerVideo(plan, isYearly);
            const savings = getYearlySavings(plan);

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-5 transition-all duration-200 ${
                  isCurrent
                    ? 'bg-green-50 border-2 border-green-500 shadow-lg shadow-green-500/10'
                    : isPopular
                      ? 'bg-gradient-to-br from-primary-50 via-white to-accent-50 border-2 border-primary-400 shadow-xl shadow-primary-500/20 hover:shadow-2xl hover:scale-[1.02]'
                      : 'bg-white border-2 border-slate-200 hover:border-slate-300 hover:shadow-lg'
                }`}
              >
                {isPopular && !isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-accent-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    ✨ RECOMMENDED
                  </span>
                )}

                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{plan.name}</h3>
                    <p className="text-sm text-slate-500">
                      {totalVideos} videos/{isYearly ? 'year' : 'month'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-extrabold text-slate-800">
                      ${price}<span className="text-sm font-normal text-slate-400">/mo</span>
                    </p>
                  </div>
                </div>

                {/* Value indicators */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                    💰 ${pricePerVideo}/video
                  </span>
                  {isYearly && savings > 0 && (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
                      🎉 Save ${savings}/year
                    </span>
                  )}
                </div>

                {isCurrent ? (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-green-600 font-semibold flex items-center gap-1.5">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Current Plan
                    </span>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={purchasingId === 'cancel'}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      {purchasingId === 'cancel' ? 'Canceling...' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleSubscribe(plan.id)}
                    variant={isPopular ? 'primary' : 'outline'}
                    className={`w-full mt-4 ${
                      isPopular
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 shadow-lg shadow-primary-500/30 text-white font-semibold'
                        : ''
                    }`}
                    isLoading={purchasingId === plan.id}
                  >
                    {isPopular ? '🚀 Start Creating' : 'Get Started'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* One-time toggle */}
        <div className="text-center pt-2">
          <button
            onClick={() => setShowOneTime(!showOneTime)}
            className="text-sm text-slate-400 hover:text-primary-500 transition-colors font-medium"
          >
            {showOneTime ? 'Hide one-time packages ↑' : 'Need credits now? Buy once →'}
          </button>
        </div>

        {/* One-time packages */}
        {showOneTime && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-slate-400 text-center mb-3">One-time purchase, no subscription</p>
            {packages.map((pkg, index) => {
              const pricePerVideo = (pkg.priceInCents / 100 / pkg.credits).toFixed(2);
              const isBestValue = index === packages.length - 1; // Last package is usually best value

              return (
                <div
                  key={pkg.id}
                  className={`flex items-center justify-between rounded-xl p-4 transition-all duration-200 hover:shadow-md ${
                    isBestValue
                      ? 'bg-gradient-to-r from-accent-50 to-white border border-accent-200'
                      : 'bg-white border border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">{pkg.name}</span>
                      {isBestValue && (
                        <span className="text-[10px] bg-accent-500 text-white px-2 py-0.5 rounded-full font-bold">
                          BEST VALUE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-slate-500">{pkg.credits} videos</span>
                      <span className="text-xs text-green-600 font-medium">${pricePerVideo}/video</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-800">${pkg.priceInCents / 100}</span>
                    <Button
                      onClick={() => handlePurchase(pkg.id)}
                      variant={isBestValue ? 'secondary' : 'ghost'}
                      size="sm"
                      isLoading={purchasingId === pkg.id}
                    >
                      Buy
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => setPage('dashboard')}
          className="w-full py-3 text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => {
          setShowLoginModal(false);
          loadData();
        }}
      />
    </div>
  );
}
