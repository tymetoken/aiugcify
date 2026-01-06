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
  const [isCanceling, setIsCanceling] = useState(false);
  const [showAllPackages, setShowAllPackages] = useState(false);

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

  const handleSubscribe = async (planId: string) => {
    setPurchasingId(planId);
    try {
      // Always use yearly for better value
      const { checkoutUrl } = await apiClient.createSubscriptionCheckout(planId, 'yearly');
      window.open(checkoutUrl, '_blank');
      setTimeout(() => {
        refreshUser();
        loadData();
      }, 5000);
    } catch (error) {
      console.error('Failed to create subscription checkout:', error);
    }
    setPurchasingId(null);
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel? You\'ll keep access until the end of your billing period.')) {
      return;
    }
    setIsCanceling(true);
    try {
      await apiClient.cancelSubscription(true);
      await loadData();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
    setIsCanceling(false);
  };

  const handleResumeSubscription = async () => {
    setIsCanceling(true);
    try {
      await apiClient.resumeSubscription();
      await loadData();
    } catch (error) {
      console.error('Failed to resume subscription:', error);
    }
    setIsCanceling(false);
  };

  // Helper functions
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  const getYearlyAsMonthly = (plan: SubscriptionPlan) => {
    return (plan.yearlyPriceInCents / 100 / 12).toFixed(2);
  };

  const getYearlyPricePerVideo = (plan: SubscriptionPlan) => {
    const totalCredits = plan.yearlyCredits + plan.yearlyBonusCredits;
    return (plan.yearlyPriceInCents / 100 / totalCredits).toFixed(2);
  };

  const getPricePerCredit = (pkg: CreditPackage) => {
    const totalCredits = pkg.credits + pkg.bonusCredits;
    return (pkg.priceInCents / 100 / totalCredits).toFixed(2);
  };

  // Find recommended plan (Standard / Most Popular)
  const recommendedPlan = subscriptionPlans.find(p => p.badgeText === 'Most Popular') || subscriptionPlans[1];
  const otherPlans = subscriptionPlans.filter(p => p.id !== recommendedPlan?.id);

  // Featured packages for compact display
  const featuredPackages = showAllPackages
    ? packages
    : packages.filter(p => ['creator', 'pro'].includes(p.id.toLowerCase()));

  const isCurrentPlan = (planId: string) =>
    subscription?.plan.id === planId && subscription?.status === 'ACTIVE';

  const canUpgrade = (plan: SubscriptionPlan) => {
    if (!subscription || subscription.status !== 'ACTIVE') return true;
    return plan.yearlyCredits > (subscription.plan.yearlyCredits || 0);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
        <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-32 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Compact Balance Header */}
        <div className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-lg px-4 py-3 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-80">Balance:</span>
            <span className="text-xl font-bold">{user?.creditBalance || 0}</span>
            <span className="text-sm opacity-80">credits</span>
          </div>
          {subscription && subscription.status === 'ACTIVE' && (
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {subscription.plan.name}
            </span>
          )}
        </div>

        {/* Active Subscription Management */}
        {subscription && subscription.status === 'ACTIVE' && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">{subscription.plan.name}</span>
                {subscription.cancelAtPeriodEnd ? (
                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-medium">
                    Canceling
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                    Active
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {subscription.creditsUsedThisPeriod}/{subscription.creditsPerPeriod} used
              </span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                style={{ width: `${Math.min((subscription.creditsUsedThisPeriod / subscription.creditsPerPeriod) * 100, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {subscription.cancelAtPeriodEnd
                  ? `Ends ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
              </span>
              {subscription.cancelAtPeriodEnd ? (
                <button
                  onClick={handleResumeSubscription}
                  disabled={isCanceling}
                  className="text-[10px] text-primary-600 font-medium hover:underline"
                >
                  {isCanceling ? 'Resuming...' : 'Resume'}
                </button>
              ) : (
                <button
                  onClick={handleCancelSubscription}
                  disabled={isCanceling}
                  className="text-[10px] text-slate-400 hover:text-red-500"
                >
                  {isCanceling ? 'Canceling...' : 'Cancel'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Hero Subscription Card - Recommended Plan */}
        {recommendedPlan && (
          <div className="relative bg-gradient-to-br from-accent-50 to-white rounded-xl border-2 border-accent-500 p-5 shadow-lg">
            {/* Animated Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-accent-500 to-primary-600 text-white text-xs font-bold rounded-full shadow-md">
              ★ MOST POPULAR
            </div>

            {/* Plan Name */}
            <div className="text-center mt-2">
              <h3 className="text-lg font-bold text-slate-800">{recommendedPlan.name}</h3>
              <p className="text-xs text-slate-500">{recommendedPlan.description}</p>
            </div>

            {/* Price with Anchoring */}
            <div className="text-center my-4">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-bold text-slate-800">${getYearlyAsMonthly(recommendedPlan)}</span>
                <span className="text-slate-400">/mo</span>
              </div>
              <div className="text-xs text-slate-400 line-through">
                ${(recommendedPlan.monthlyPriceInCents / 100).toFixed(0)}/mo if paid monthly
              </div>

              {/* Value Badge */}
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ${getYearlyPricePerVideo(recommendedPlan)}/video
              </div>
            </div>

            {/* Credits Display */}
            <div className="bg-white rounded-lg p-3 text-center mb-4 border border-slate-100">
              <span className="text-2xl font-bold text-primary-700">
                {recommendedPlan.yearlyCredits + recommendedPlan.yearlyBonusCredits}
              </span>
              <span className="text-sm text-slate-500 ml-1">videos/year</span>
              {recommendedPlan.yearlyBonusCredits > 0 && (
                <span className="block text-xs text-green-600 mt-1">
                  Includes {recommendedPlan.yearlyBonusCredits} bonus credits
                </span>
              )}
            </div>

            {/* CTA Button */}
            {isCurrentPlan(recommendedPlan.id) ? (
              <div className="text-center py-2">
                <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Your Current Plan
                </span>
              </div>
            ) : (
              <Button
                onClick={() => handleSubscribe(recommendedPlan.id)}
                size="lg"
                className="w-full"
                isLoading={purchasingId === recommendedPlan.id}
                disabled={!canUpgrade(recommendedPlan)}
              >
                {subscription && subscription.status === 'ACTIVE'
                  ? 'Upgrade Plan'
                  : 'Start Creating Videos'}
              </Button>
            )}
          </div>
        )}

        {/* Alternative Plans Row */}
        {otherPlans.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {otherPlans.map((plan) => {
              const totalCredits = plan.yearlyCredits + plan.yearlyBonusCredits;
              const pricePerVideo = getYearlyPricePerVideo(plan);
              const isCurrent = isCurrentPlan(plan.id);
              const canUpgradeToPlan = canUpgrade(plan);

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-lg border p-3 ${
                    isCurrent
                      ? 'border-green-500 bg-green-50/50'
                      : plan.badgeText === 'Best Value'
                        ? 'border-accent-300'
                        : 'border-slate-200'
                  }`}
                >
                  {plan.badgeText && !isCurrent && (
                    <span className="absolute -top-2 right-2 text-[9px] bg-accent-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                      {plan.badgeText}
                    </span>
                  )}

                  <h4 className="text-sm font-semibold text-slate-700">{plan.name}</h4>
                  <p className="text-lg font-bold text-slate-800">${getYearlyAsMonthly(plan)}<span className="text-xs font-normal text-slate-400">/mo</span></p>
                  <p className="text-xs text-slate-400">{totalCredits} videos/yr</p>
                  <p className="text-xs text-green-600 font-medium">${pricePerVideo}/video</p>

                  {isCurrent ? (
                    <div className="mt-2 text-center">
                      <span className="text-[10px] text-green-600 font-medium">✓ Current</span>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(plan.id)}
                      variant={plan.badgeText === 'Best Value' ? 'secondary' : 'outline'}
                      size="sm"
                      className="w-full mt-2"
                      isLoading={purchasingId === plan.id}
                      disabled={!canUpgradeToPlan}
                    >
                      {!canUpgradeToPlan ? 'Downgrade' : 'Choose'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium">Or buy credits once</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* One-Time Packages (Compact) */}
        <div className="space-y-2">
          {featuredPackages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors"
            >
              <div>
                <span className="text-sm font-medium text-slate-700">{pkg.name}</span>
                <span className="text-xs text-slate-400 ml-2">
                  {pkg.credits + pkg.bonusCredits} videos
                </span>
                {pkg.bonusCredits > 0 && (
                  <span className="text-[10px] text-green-600 ml-1">+{pkg.bonusCredits} bonus</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">{formatPrice(pkg.priceInCents)}</span>
                  <span className="text-[10px] text-slate-400 block">${getPricePerCredit(pkg)}/vid</span>
                </div>
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

          {!showAllPackages && packages.length > featuredPackages.length && (
            <button
              onClick={() => setShowAllPackages(true)}
              className="text-xs text-slate-400 hover:text-primary-500 w-full text-center py-2"
            >
              See all {packages.length} packages →
            </button>
          )}
        </div>

        {/* Back Button */}
        <Button onClick={() => setPage('dashboard')} variant="ghost" className="w-full mt-2">
          ← Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
