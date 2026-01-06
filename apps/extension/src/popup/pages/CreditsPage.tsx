import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { apiClient } from '@/shared/api-client';
import { Button } from '../components/Button';
import type { CreditPackage, SubscriptionPlan, UserSubscription } from '@aiugcify/shared-types';

export function CreditsPage() {
  const { user, refreshUser } = useAuthStore();
  const { setPage } = useUIStore();

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

      try {
        const subscriptionRes = await apiClient.getSubscriptionStatus();
        setSubscription(subscriptionRes.subscription);
      } catch {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setIsLoading(false);
  };

  const handleSubscribe = async (planId: string) => {
    setPurchasingId(planId);
    try {
      const { checkoutUrl } = await apiClient.createSubscriptionCheckout(planId, billingInterval);
      window.open(checkoutUrl, '_blank');
      setTimeout(() => {
        refreshUser();
        loadData();
      }, 5000);
    } catch (error) {
      console.error('Failed to create checkout:', error);
    }
    setPurchasingId(null);
  };

  const handlePurchase = async (packageId: string) => {
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

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 space-y-4">
        <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const isCurrentPlan = (planId: string) =>
    subscription?.plan.id === planId && subscription?.status === 'ACTIVE';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Balance */}
        <div className="flex items-center justify-between">
          <button onClick={() => setPage('dashboard')} className="text-slate-400 hover:text-slate-600">
            ← Back
          </button>
          <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
            <span className="text-sm text-slate-500">Credits:</span>
            <span className="font-bold text-slate-800">{user?.creditBalance || 0}</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">Choose Your Plan</h1>
          <p className="text-sm text-slate-500 mb-3">Cancel anytime.</p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-slate-100 rounded-full p-1">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                billingInterval === 'monthly'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                billingInterval === 'yearly'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Yearly
              <span className="ml-1 text-xs text-green-600 font-bold">-17%</span>
            </button>
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="space-y-3">
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

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 p-4 transition-all ${
                  isCurrent
                    ? 'border-green-500 bg-green-50'
                    : isPopular
                      ? 'border-primary-500 bg-primary-50/30 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {isPopular && !isCurrent && (
                  <span className="absolute -top-2.5 left-4 bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    RECOMMENDED
                  </span>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{plan.name}</h3>
                    <p className="text-sm text-slate-500">
                      {totalVideos} videos/{isYearly ? 'year' : 'month'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-800">
                      ${price}<span className="text-sm font-normal text-slate-400">/mo</span>
                    </p>
                  </div>
                </div>

                {isCurrent ? (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Current Plan
                    </span>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={purchasingId === 'cancel'}
                      className="text-xs text-slate-400 hover:text-red-500"
                    >
                      {purchasingId === 'cancel' ? 'Canceling...' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleSubscribe(plan.id)}
                    variant={isPopular ? 'primary' : 'outline'}
                    className="w-full mt-3"
                    isLoading={purchasingId === plan.id}
                  >
                    Get Started
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
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            {showOneTime ? 'Hide one-time packages ↑' : 'Need credits now? Buy once →'}
          </button>
        </div>

        {/* One-time packages */}
        {showOneTime && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-slate-400 text-center">One-time purchase, no subscription</p>
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between bg-slate-50 rounded-lg p-3"
              >
                <div>
                  <span className="font-medium text-slate-700">{pkg.name}</span>
                  <span className="text-sm text-slate-400 ml-2">{pkg.credits} videos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">${pkg.priceInCents / 100}</span>
                  <Button
                    onClick={() => handlePurchase(pkg.id)}
                    variant="ghost"
                    size="sm"
                    isLoading={purchasingId === pkg.id}
                  >
                    Buy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
