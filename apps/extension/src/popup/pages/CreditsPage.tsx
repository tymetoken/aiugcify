import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { apiClient } from '@/shared/api-client';
import { Button } from '../components/Button';
import { LoginModal } from '../components/LoginModal';
import { Toast, useToast } from '../components/Toast';
import type { CreditPackage, SubscriptionPlan, UserSubscription, Invoice } from '@aiugcify/shared-types';

interface CancelSubscriptionModalProps {
  planName: string;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function CancelSubscriptionModal({
  planName,
  isLoading,
  onConfirm,
  onCancel,
}: CancelSubscriptionModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-rose-500 p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="text-lg font-bold">Cancel Subscription</h3>
              <p className="text-sm opacity-90">Are you sure you want to cancel?</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="bg-red-50 rounded-xl p-4 mb-4 border border-red-100">
            <p className="text-sm text-slate-700 mb-3">
              You're about to cancel your <strong>{planName}</strong> subscription.
            </p>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <p className="text-sm text-slate-600">
                You'll keep access to all features until your current billing period ends.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-100">
            <div className="flex gap-2">
              <span className="text-lg">💡</span>
              <p className="text-xs text-slate-600">
                Need a different plan instead? You can always switch to a plan that better fits your needs.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 text-white font-semibold hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg"
            >
              Keep Subscription
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Canceling...
                </span>
              ) : (
                'Yes, Cancel'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const currentMonthlyPrice = currentIsYearly
    ? Math.round(currentPlan.yearlyPriceInCents / 100 / 12)
    : Math.round(currentPlan.monthlyPriceInCents / 100);
  const targetMonthlyPrice = isYearly
    ? Math.round(targetPlan.yearlyPriceInCents / 100 / 12)
    : Math.round(targetPlan.monthlyPriceInCents / 100);

  const targetTotalPrice = isYearly
    ? targetPlan.yearlyPriceInCents / 100
    : targetPlan.monthlyPriceInCents / 100;

  const currentCredits = currentPlan.monthlyCredits;
  const targetCredits = targetPlan.monthlyCredits;
  const creditsDiff = targetCredits - currentCredits;
  const priceDiff = targetMonthlyPrice - currentMonthlyPrice;

  const tierColors = {
    basic: { gradient: 'from-amber-500 to-orange-500', icon: '🥉', bg: 'bg-amber-50/80', border: 'border-amber-200', text: 'text-amber-700' },
    standard: { gradient: 'from-slate-400 to-slate-500', icon: '🥈', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
    premium: { gradient: 'from-yellow-400 to-amber-500', icon: '🥇', bg: 'bg-yellow-50/80', border: 'border-yellow-200', text: 'text-yellow-700' },
  };

  const currentTier = tierColors[currentPlan.id as keyof typeof tierColors] || tierColors.basic;
  const targetTier = tierColors[targetPlan.id as keyof typeof tierColors] || tierColors.basic;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl w-full max-w-[320px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Compact Header */}
        <div className={`bg-gradient-to-r ${targetTier.gradient} px-4 py-3`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">{targetTier.icon}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">
                {changeType === 'upgrade' ? 'Upgrade to' : 'Switch to'} {targetPlan.name}
              </h3>
              <p className="text-xs text-white/80">
                {changeType === 'upgrade' ? 'More videos, more creativity' : 'Adjust your plan'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {/* Compact Plan Comparison */}
          <div className="flex items-center gap-2 mb-3">
            {/* Current */}
            <div className={`flex-1 ${currentTier.bg} rounded-xl p-2.5 border ${currentTier.border} text-center`}>
              <span className="text-lg">{currentTier.icon}</span>
              <p className={`text-xs font-bold ${currentTier.text}`}>{currentPlan.name}</p>
              <p className="text-[10px] text-slate-500">{currentCredits} videos/mo</p>
              <p className="text-sm font-bold text-slate-700">${currentMonthlyPrice}<span className="text-[10px] font-normal">/mo</span></p>
            </div>

            {/* Arrow */}
            <div className={`w-7 h-7 rounded-full bg-gradient-to-r ${targetTier.gradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>

            {/* Target */}
            <div className={`flex-1 ${targetTier.bg} rounded-xl p-2.5 border-2 ${targetTier.border} text-center ring-1 ring-offset-1 ${targetTier.border.replace('border', 'ring')}`}>
              <span className="text-lg">{targetTier.icon}</span>
              <p className={`text-xs font-bold ${targetTier.text}`}>{targetPlan.name}</p>
              <p className="text-[10px] text-slate-500">{targetCredits} videos/mo</p>
              <p className="text-sm font-bold text-slate-800">${targetMonthlyPrice}<span className="text-[10px] font-normal">/mo</span></p>
            </div>
          </div>

          {/* Summary Box */}
          <div className={`${targetTier.bg} rounded-xl p-3 mb-3 border ${targetTier.border}`}>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase font-medium">Videos/Month</p>
                <p className={`text-lg font-bold ${targetTier.text}`}>{targetCredits}</p>
                {creditsDiff !== 0 && (
                  <p className={`text-[10px] font-medium ${creditsDiff > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                    {creditsDiff > 0 ? `+${creditsDiff}` : creditsDiff} videos
                  </p>
                )}
              </div>
              <div className="text-center border-l border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase font-medium">{isYearly ? 'Per Year' : 'Per Month'}</p>
                <p className={`text-lg font-bold ${targetTier.text}`}>${targetTotalPrice}</p>
                {priceDiff !== 0 && (
                  <p className={`text-[10px] font-medium ${priceDiff < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                    {priceDiff > 0 ? `+$${priceDiff}` : `-$${Math.abs(priceDiff)}`}/mo
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {changeType === 'upgrade'
                ? "Charged prorated difference today. New credits available immediately."
                : "Takes effect next billing cycle. Credit applied to future invoices."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 px-3 rounded-xl border-2 border-slate-200 text-slate-500 text-sm font-semibold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r ${targetTier.gradient} text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing
                </span>
              ) : (
                changeType === 'upgrade' ? 'Upgrade Now' : 'Switch Plan'
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [showOneTime, setShowOneTime] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const [changePlanTarget, setChangePlanTarget] = useState<SubscriptionPlan | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isLoadingBillingPortal, setIsLoadingBillingPortal] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when the popup becomes visible again (user clicks on extension)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

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
          const [subscriptionRes, invoicesRes] = await Promise.all([
            apiClient.getSubscriptionStatus(),
            apiClient.getInvoices(5),
          ]);
          setSubscription(subscriptionRes.subscription);
          setInvoices(invoicesRes.invoices);
        } catch {
          setSubscription(null);
          setInvoices([]);
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

  const handleCancelSubscription = async () => {
    setPurchasingId('cancel');
    try {
      await apiClient.cancelSubscription(true);
      await loadData();
      setShowCancelModal(false);
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

  const handleOpenBillingPortal = async () => {
    setIsLoadingBillingPortal(true);
    try {
      const { url } = await apiClient.createBillingPortalSession();
      chrome.tabs.create({ url });
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      showToast('Failed to open billing portal', 'error');
    }
    setIsLoadingBillingPortal(false);
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
        {hasActiveSubscription && subscription && (() => {
          const tierColors = {
            basic: {
              gradient: 'from-amber-600 to-orange-700',
              shadow: 'shadow-amber-600/30',
              icon: '🥉',
            },
            standard: {
              gradient: 'from-slate-400 to-slate-500',
              shadow: 'shadow-slate-400/30',
              icon: '🥈',
            },
            premium: {
              gradient: 'from-yellow-500 to-amber-500',
              shadow: 'shadow-yellow-500/30',
              icon: '🥇',
            },
          };
          const colors = tierColors[subscription.plan.id as keyof typeof tierColors] || tierColors.basic;

          const monthlyAllocation = subscription.plan.monthlyCredits;
          const isYearlyPlan = subscription.interval === 'YEARLY';

          return (
            <div className={`bg-gradient-to-r ${colors.gradient} rounded-2xl p-4 text-white shadow-lg ${colors.shadow}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium opacity-80">Your Current Plan</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-lg font-bold">{subscription.plan.name}</p>
                    <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                      {isYearlyPlan ? 'Yearly' : 'Monthly'}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-1">
                    {monthlyAllocation} videos/month
                  </p>
                </div>
                <div className="text-right">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                    {colors.icon}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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

        {/* Subscription Plans - Compact Design */}
        <div className="space-y-3 pt-2">
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

            // Tier-specific colors
            const tierStyles = {
              basic: {
                bg: 'bg-gradient-to-br from-amber-50/80 to-orange-50/80',
                border: 'border-amber-400',
                shadow: 'shadow-amber-500/20',
                text: 'text-amber-700',
                icon: '🥉',
                pill: 'bg-amber-100 text-amber-700',
              },
              standard: {
                bg: 'bg-gradient-to-br from-slate-50 to-slate-100/80',
                border: 'border-slate-400',
                shadow: 'shadow-slate-400/20',
                text: 'text-slate-600',
                icon: '🥈',
                pill: 'bg-slate-100 text-slate-700',
              },
              premium: {
                bg: 'bg-gradient-to-br from-yellow-50/80 to-amber-50/80',
                border: 'border-yellow-400',
                shadow: 'shadow-yellow-500/20',
                text: 'text-yellow-700',
                icon: '🥇',
                pill: 'bg-yellow-100 text-yellow-700',
              },
            };
            const tierStyle = tierStyles[plan.id as keyof typeof tierStyles] || tierStyles.basic;

            const yearlyTotal = plan.yearlyPriceInCents / 100;

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl overflow-hidden transition-all duration-200 ${
                  isCurrentWithSameInterval
                    ? `border-2 ${tierStyle.border} shadow-lg ${tierStyle.shadow}`
                    : isPopular
                      ? 'border-2 border-primary-400 shadow-lg shadow-primary-500/20 hover:shadow-xl'
                      : 'border border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {/* Compact Badge - Only for Most Popular and Current Plan */}
                {isPopular && !isCurrentWithSameInterval && (
                  <div className="bg-gradient-to-r from-primary-500 to-accent-500 text-white text-[10px] font-bold px-3 py-1 text-center uppercase tracking-wide">
                    Most Popular
                  </div>
                )}
                {isCurrentWithSameInterval && (
                  <div className={`bg-gradient-to-r ${
                    plan.id === 'basic' ? 'from-amber-500 to-orange-500' :
                    plan.id === 'standard' ? 'from-slate-500 to-slate-600' :
                    'from-yellow-500 to-amber-500'
                  } text-white text-[10px] font-bold px-3 py-1 text-center uppercase tracking-wide`}>
                    Current Plan
                  </div>
                )}

                <div className={`p-3 ${isCurrentWithSameInterval ? tierStyle.bg : 'bg-white'}`}>
                  {/* Header: Icon + Name + Price */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tierStyle.icon}</span>
                      <h3 className="text-base font-bold text-slate-800">{plan.name}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-slate-800">${price}</span>
                      <span className="text-xs text-slate-500">/mo</span>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tierStyle.pill}`}>
                      {plan.monthlyCredits} videos/mo
                    </span>
                    <span className="text-[11px] text-green-600 font-semibold">
                      ${pricePerVideo}/video
                    </span>
                  </div>

                  {/* Yearly Info */}
                  {isYearly && (
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                      <span>{totalVideos} videos/year • ${yearlyTotal}/yr</span>
                      <span className="text-green-600 font-semibold">Save ${savings}</span>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="mt-3">
                    {isCurrentWithSameInterval ? (
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="w-full py-1.5 text-[11px] text-slate-400 hover:text-red-500 transition-colors"
                      >
                        Cancel subscription
                      </button>
                    ) : canChange ? (
                      <button
                        onClick={() => setChangePlanTarget(plan)}
                        disabled={purchasingId === plan.id}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          changeType === 'upgrade'
                            ? 'border border-green-300 text-green-600 hover:bg-green-50'
                            : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {changeType === 'upgrade' ? 'Upgrade to ' + plan.name : 'Switch to ' + plan.name}
                      </button>
                    ) : (
                      <Button
                        onClick={() => handleSubscribe(plan.id)}
                        variant={isPopular ? 'primary' : 'outline'}
                        size="sm"
                        className={`w-full ${
                          isPopular
                            ? 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 shadow-sm text-white font-semibold'
                            : ''
                        }`}
                        isLoading={purchasingId === plan.id}
                      >
                        {isPopular ? 'Get Started' : 'Choose Plan'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* One-time toggle - Primary CTA */}
        <div className="text-center pt-3">
          <button
            onClick={() => setShowOneTime(!showOneTime)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              showOneTime
                ? 'text-slate-500 hover:text-slate-700'
                : 'bg-gradient-to-r from-accent-500/10 to-primary-500/10 text-primary-600 hover:from-accent-500/20 hover:to-primary-500/20 border border-primary-200'
            }`}
          >
            {showOneTime ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                Hide one-time packages
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Need credits now? Buy once
              </>
            )}
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

        {/* Billing History Toggle - Secondary action */}
        {isAuthenticated && (
          <div className="text-center pt-1">
            <button
              onClick={() => setShowBilling(!showBilling)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {showBilling ? 'Hide billing history' : 'View billing history'}
              <svg className={`w-3 h-3 transition-transform ${showBilling ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Billing Section */}
        {showBilling && isAuthenticated && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Billing History</h3>
              <button
                onClick={handleOpenBillingPortal}
                disabled={isLoadingBillingPortal}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                {isLoadingBillingPortal ? (
                  <>
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Opening...
                  </>
                ) : (
                  <>
                    Manage Billing
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Invoice List */}
            {invoices.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {invoices.map((invoice, index) => {
                  const isPaid = invoice.status === 'paid';
                  const formattedDate = new Date(invoice.created).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const amount = (invoice.amountPaid / 100).toFixed(2);

                  return (
                    <div
                      key={invoice.id}
                      className={`flex items-center justify-between p-3 ${
                        index !== invoices.length - 1 ? 'border-b border-slate-100' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700 truncate">
                            {invoice.description}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            isPaid
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isPaid ? 'Paid' : invoice.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{formattedDate}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-800">
                          ${amount}
                        </span>
                        {invoice.invoicePdf && (
                          <a
                            href={invoice.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-primary-500 transition-colors"
                            title="Download PDF"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-sm text-slate-500">No billing history yet</p>
                <p className="text-xs text-slate-400 mt-1">Invoices will appear here after your first purchase</p>
              </div>
            )}
          </div>
        )}

        {/* Back Button - Tertiary navigation */}
        <div className="pt-4 pb-2 border-t border-slate-100 mt-4">
          <button
            onClick={() => setPage('dashboard')}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-slate-400 hover:text-slate-500 transition-colors text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>
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

      {/* Cancel Subscription Modal */}
      {showCancelModal && subscription && (
        <CancelSubscriptionModal
          planName={subscription.plan.name}
          isLoading={purchasingId === 'cancel'}
          onConfirm={handleCancelSubscription}
          onCancel={() => setShowCancelModal(false)}
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
