import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { apiClient } from '@/shared/api-client';
import { Button } from '../components/Button';
import { LoginModal } from '../components/LoginModal';
import { Toast, useToast } from '../components/Toast';
import type { CreditPackage, SubscriptionPlan, UserSubscription } from '@aiugcify/shared-types';

interface PlanChangeModalProps {
  currentPlan: SubscriptionPlan;
  currentInterval: string;
  targetPlan: SubscriptionPlan;
  targetInterval: 'monthly' | 'yearly';
  changeType: 'upgrade' | 'downgrade' | 'switch';
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function PlanChangeModal({
  currentPlan,
  currentInterval,
  targetPlan,
  targetInterval,
  changeType,
  isLoading,
  onConfirm,
  onCancel,
}: PlanChangeModalProps) {
  const isYearly = targetInterval === 'yearly';
  const currentIsYearly = currentInterval === 'YEARLY';

  const currentPrice = currentIsYearly
    ? Math.round(currentPlan.yearlyPriceInCents / 100 / 12)
    : Math.round(currentPlan.monthlyPriceInCents / 100);
  const targetPrice = isYearly
    ? Math.round(targetPlan.yearlyPriceInCents / 100 / 12)
    : Math.round(targetPlan.monthlyPriceInCents / 100);

  const currentCredits = currentIsYearly
    ? currentPlan.yearlyCredits + currentPlan.yearlyBonusCredits
    : currentPlan.monthlyCredits;
  const targetCredits = isYearly
    ? targetPlan.yearlyCredits + targetPlan.yearlyBonusCredits
    : targetPlan.monthlyCredits;

  const priceDiff = targetPrice - currentPrice;
  const creditsDiff = targetCredits - currentCredits;

  const config = {
    upgrade: {
      icon: '⬆️',
      title: 'Upgrade Your Plan',
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50 to-emerald-50',
      borderColor: 'border-green-200',
      buttonGradient: 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
      description: 'Get more videos and unlock your creative potential!',
    },
    downgrade: {
      icon: '⬇️',
      title: 'Change Your Plan',
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50',
      borderColor: 'border-amber-200',
      buttonGradient: 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
      description: 'Adjust your plan to better fit your needs.',
    },
    switch: {
      icon: '🔄',
      title: 'Switch Billing Cycle',
      gradient: 'from-blue-500 to-indigo-500',
      bgGradient: 'from-blue-50 to-indigo-50',
      borderColor: 'border-blue-200',
      buttonGradient: 'from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600',
      description: 'Change your billing frequency.',
    },
  };

  const c = config[changeType];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`bg-gradient-to-r ${c.gradient} p-5 text-white`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{c.icon}</span>
            <div>
              <h3 className="text-lg font-bold">{c.title}</h3>
              <p className="text-sm opacity-90">{c.description}</p>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            {/* Current Plan */}
            <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-xs text-slate-400 mb-1">Current</p>
              <p className="font-semibold text-slate-700">{currentPlan.name}</p>
              <p className="text-sm text-slate-500">{currentCredits} videos</p>
              <p className="text-lg font-bold text-slate-800">${currentPrice}/mo</p>
            </div>

            {/* Arrow */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r ${c.gradient} flex items-center justify-center text-white`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>

            {/* New Plan */}
            <div className={`flex-1 bg-gradient-to-br ${c.bgGradient} rounded-xl p-3 border-2 ${c.borderColor}`}>
              <p className="text-xs text-slate-500 mb-1">New</p>
              <p className="font-semibold text-slate-800">{targetPlan.name}</p>
              <p className="text-sm text-slate-600">{targetCredits} videos</p>
              <p className="text-lg font-bold text-slate-900">${targetPrice}/mo</p>
            </div>
          </div>

          {/* Changes Summary */}
          <div className={`rounded-xl p-4 mb-4 bg-gradient-to-r ${c.bgGradient} border ${c.borderColor}`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">What changes</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Monthly price</span>
                <span className={`text-sm font-semibold ${priceDiff > 0 ? 'text-amber-600' : priceDiff < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                  {priceDiff > 0 ? '+' : ''}{priceDiff === 0 ? 'No change' : `$${priceDiff}/mo`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Videos per {isYearly ? 'year' : 'month'}</span>
                <span className={`text-sm font-semibold ${creditsDiff > 0 ? 'text-green-600' : creditsDiff < 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                  {creditsDiff > 0 ? '+' : ''}{creditsDiff === 0 ? 'No change' : creditsDiff}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Billing cycle</span>
                <span className="text-sm font-semibold text-slate-700">
                  {currentInterval === targetInterval.toUpperCase() ? 'No change' : `${currentIsYearly ? 'Yearly' : 'Monthly'} → ${isYearly ? 'Yearly' : 'Monthly'}`}
                </span>
              </div>
            </div>
          </div>

          {/* Proration Note */}
          <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
            <div className="flex gap-2">
              <span className="text-lg">💡</span>
              <p className="text-xs text-slate-500">
                {changeType === 'upgrade'
                  ? "You'll be charged a prorated amount for the upgrade. The difference is calculated based on your remaining billing cycle."
                  : changeType === 'downgrade'
                    ? "You'll receive a prorated credit that will be applied to your future invoices."
                    : "Your billing cycle will be updated. Any price difference will be prorated."}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 py-3 px-4 rounded-xl bg-gradient-to-r ${c.buttonGradient} text-white font-semibold shadow-lg transition-all disabled:opacity-50`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                `Confirm ${changeType === 'upgrade' ? 'Upgrade' : changeType === 'downgrade' ? 'Change' : 'Switch'}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreditsPage() {
  const { refreshUser, isAuthenticated } = useAuthStore();
  const { setPage } = useUIStore();
  const { toast, showToast, hideToast } = useToast();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [showOneTime, setShowOneTime] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const [changePlanTarget, setChangePlanTarget] = useState<SubscriptionPlan | null>(null);

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
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setPurchasingId(planId);
    try {
      const response = await apiClient.createSubscriptionCheckout(planId, billingInterval);
      const { checkoutUrl } = response;
      if (checkoutUrl) {
        chrome.tabs.create({ url: checkoutUrl });
      }
      setTimeout(() => {
        refreshUser();
        loadData();
      }, 5000);
    } catch (error) {
      console.error('Failed to create checkout:', error);
      showToast('Failed to create checkout: ' + (error as Error).message, 'error');
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
      showToast('Subscription cancelled. You\'ll keep access until the billing period ends.', 'info');
    } catch (error) {
      console.error('Failed to cancel:', error);
      showToast('Failed to cancel subscription', 'error');
    }
    setPurchasingId(null);
  };

  const handleChangePlan = async () => {
    if (!changePlanTarget) return;
    setPurchasingId(changePlanTarget.id);
    try {
      await apiClient.changeSubscriptionPlan(changePlanTarget.id, billingInterval);
      await refreshUser();
      await loadData();
      setChangePlanTarget(null);
      showToast('Plan changed successfully! 🎉', 'success');
    } catch (error) {
      console.error('Failed to change plan:', error);
      showToast('Failed to change plan: ' + (error as Error).message, 'error');
    }
    setPurchasingId(null);
  };

  const canChangeToPlan = (planId: string) => {
    if (!subscription || subscription.status !== 'ACTIVE') return false;
    return subscription.plan.id !== planId || subscription.interval !== billingInterval.toUpperCase();
  };

  const getChangeType = (targetPlan: SubscriptionPlan): 'upgrade' | 'downgrade' | 'switch' => {
    if (!subscription) return 'upgrade';
    const currentPlan = subscription.plan;
    const currentPrice = subscription.interval === 'MONTHLY'
      ? currentPlan.monthlyPriceInCents
      : currentPlan.yearlyPriceInCents;
    const targetPrice = billingInterval === 'monthly'
      ? targetPlan.monthlyPriceInCents
      : targetPlan.yearlyPriceInCents;

    if (targetPrice > currentPrice) return 'upgrade';
    if (targetPrice < currentPrice) return 'downgrade';
    return 'switch';
  };

  const getPricePerVideo = (plan: SubscriptionPlan, isYearly: boolean) => {
    const totalPrice = isYearly ? plan.yearlyPriceInCents : plan.monthlyPriceInCents * 12;
    const totalVideos = isYearly
      ? plan.yearlyCredits + plan.yearlyBonusCredits
      : plan.monthlyCredits * 12;
    return (totalPrice / 100 / totalVideos).toFixed(2);
  };

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

  const hasActiveSubscription = subscription?.status === 'ACTIVE';

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}

      <div className="p-4 space-y-4">
        {/* Current Plan Banner (when subscribed) */}
        {hasActiveSubscription && subscription && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 text-white shadow-lg shadow-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium opacity-80">Your Current Plan</p>
                <p className="text-lg font-bold">{subscription.plan.name}</p>
                <p className="text-sm opacity-90">
                  {subscription.creditsRemaining} videos remaining • {subscription.interval === 'MONTHLY' ? 'Monthly' : 'Yearly'} billing
                </p>
              </div>
              <div className="text-right">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">
            {hasActiveSubscription ? 'Change Your Plan' : 'Choose Your Plan'}
          </h1>
          <p className="text-sm text-slate-500 mb-3">
            {hasActiveSubscription ? 'Upgrade or switch plans anytime.' : 'Cancel anytime.'}
          </p>

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
            const isCurrentWithSameInterval = isCurrent && subscription?.interval === billingInterval.toUpperCase();
            const isPopular = plan.badgeText === 'Most Popular';
            const pricePerVideo = getPricePerVideo(plan, isYearly);
            const savings = getYearlySavings(plan);
            const changeType = hasActiveSubscription ? getChangeType(plan) : null;
            const canChange = canChangeToPlan(plan.id);

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-5 transition-all duration-200 ${
                  isCurrentWithSameInterval
                    ? 'bg-green-50 border-2 border-green-500 shadow-lg shadow-green-500/10'
                    : isPopular
                      ? 'bg-gradient-to-br from-primary-50 via-white to-accent-50 border-2 border-primary-400 shadow-xl shadow-primary-500/20 hover:shadow-2xl hover:scale-[1.02]'
                      : 'bg-white border-2 border-slate-200 hover:border-slate-300 hover:shadow-lg'
                }`}
              >
                {/* Badge */}
                {isPopular && !isCurrentWithSameInterval && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-accent-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    ✨ RECOMMENDED
                  </span>
                )}

                {/* Upgrade/Downgrade indicator for subscribed users */}
                {hasActiveSubscription && canChange && changeType && (
                  <span className={`absolute -top-3 right-4 text-xs font-bold px-3 py-1 rounded-full shadow ${
                    changeType === 'upgrade'
                      ? 'bg-green-500 text-white'
                      : changeType === 'downgrade'
                        ? 'bg-amber-500 text-white'
                        : 'bg-blue-500 text-white'
                  }`}>
                    {changeType === 'upgrade' ? '⬆️ UPGRADE' : changeType === 'downgrade' ? '⬇️ DOWNGRADE' : '🔄 SWITCH'}
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

                {/* Action Button */}
                {isCurrentWithSameInterval ? (
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
                      {purchasingId === 'cancel' ? 'Canceling...' : 'Cancel subscription'}
                    </button>
                  </div>
                ) : canChange ? (
                  <button
                    onClick={() => setChangePlanTarget(plan)}
                    disabled={purchasingId === plan.id}
                    className={`w-full mt-4 py-3 px-4 rounded-xl font-semibold transition-all ${
                      changeType === 'upgrade'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/30'
                        : changeType === 'downgrade'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30'
                          : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                    }`}
                  >
                    {changeType === 'upgrade' ? '⬆️ Upgrade to ' + plan.name : changeType === 'downgrade' ? '⬇️ Switch to ' + plan.name : '🔄 Switch billing'}
                  </button>
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
              const isBestValue = index === packages.length - 1;

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

      {/* Plan Change Modal */}
      {changePlanTarget && subscription && (
        <PlanChangeModal
          currentPlan={subscription.plan}
          currentInterval={subscription.interval}
          targetPlan={changePlanTarget}
          targetInterval={billingInterval}
          changeType={getChangeType(changePlanTarget)}
          isLoading={purchasingId === changePlanTarget.id}
          onConfirm={handleChangePlan}
          onCancel={() => setChangePlanTarget(null)}
        />
      )}

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
