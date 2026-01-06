import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { apiClient } from '@/shared/api-client';
import { Button } from '../components/Button';
import type { CreditPackage, SubscriptionPlan, UserSubscription } from '@aiugcify/shared-types';

type PurchaseType = 'one-time' | 'subscription';
type BillingInterval = 'monthly' | 'yearly';

export function CreditsPage() {
  const { user, refreshUser } = useAuthStore();
  const { setPage } = useUIStore();

  const [purchaseType, setPurchaseType] = useState<PurchaseType>('one-time');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('yearly');

  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch packages and plans (public endpoints)
      const [packagesRes, plansRes] = await Promise.all([
        apiClient.getPackages(),
        apiClient.getSubscriptionPlans(),
      ]);
      setPackages(packagesRes.packages);
      setSubscriptionPlans(plansRes.plans);

      // Fetch subscription status separately (requires auth, may fail)
      try {
        const subscriptionRes = await apiClient.getSubscriptionStatus();
        setSubscription(subscriptionRes.subscription);
      } catch {
        // User not authenticated or no subscription - that's OK
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
      const { checkoutUrl } = await apiClient.createSubscriptionCheckout(planId, billingInterval);
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
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
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

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  const getPricePerCredit = (pkg: CreditPackage) => {
    const totalCredits = pkg.credits + pkg.bonusCredits;
    return (pkg.priceInCents / 100 / totalCredits).toFixed(2);
  };

  const getSubscriptionPricePerCredit = (plan: SubscriptionPlan, interval: BillingInterval) => {
    if (interval === 'monthly') {
      return (plan.monthlyPriceInCents / 100 / plan.monthlyCredits).toFixed(2);
    }
    const totalCredits = plan.yearlyCredits + plan.yearlyBonusCredits;
    return (plan.yearlyPriceInCents / 100 / totalCredits).toFixed(2);
  };

  const getSavingsPercent = () => '17%';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Current Balance Card */}
        <div className="bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Current Balance</p>
              <p className="text-3xl font-bold mt-1">{user?.creditBalance || 0} Credits</p>
            </div>
            {user?.hasActiveSubscription && subscription && (
              <div className="bg-white/20 rounded-lg px-3 py-1.5">
                <p className="text-xs font-medium">{subscription.plan.name}</p>
                <p className="text-xs opacity-75">
                  {subscription.interval === 'MONTHLY' ? 'Monthly' : 'Yearly'}
                </p>
              </div>
            )}
          </div>
          <p className="text-sm opacity-75 mt-2">1 credit = 1 video generation</p>
        </div>

        {/* Active Subscription Card */}
        {subscription && subscription.status === 'ACTIVE' && (
          <div className="bg-white rounded-xl border-2 border-primary-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-800">{subscription.plan.name} Plan</h4>
                <p className="text-sm text-slate-500">
                  {subscription.creditsPerPeriod} credits/{subscription.interval === 'MONTHLY' ? 'month' : 'year'}
                </p>
              </div>
              {subscription.cancelAtPeriodEnd ? (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                  Canceling
                </span>
              ) : (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  Active
                </span>
              )}
            </div>

            {/* Usage Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Credits used this period</span>
                <span>{subscription.creditsUsedThisPeriod} / {subscription.creditsPerPeriod}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min((subscription.creditsUsedThisPeriod / subscription.creditsPerPeriod) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              {subscription.cancelAtPeriodEnd
                ? `Access until ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
            </p>

            {subscription.cancelAtPeriodEnd ? (
              <Button
                onClick={handleResumeSubscription}
                variant="secondary"
                size="sm"
                className="w-full"
                isLoading={isCanceling}
              >
                Resume Subscription
              </Button>
            ) : (
              <Button
                onClick={handleCancelSubscription}
                variant="ghost"
                size="sm"
                className="w-full text-red-600 hover:bg-red-50"
                isLoading={isCanceling}
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        )}

        {/* Purchase Type Toggle */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setPurchaseType('one-time')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              purchaseType === 'one-time'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            One-Time
          </button>
          <button
            onClick={() => setPurchaseType('subscription')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              purchaseType === 'subscription'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Subscription
          </button>
        </div>

        {purchaseType === 'subscription' && (
          <>
            {/* Billing Interval Toggle */}
            <div className="flex items-center justify-center gap-3">
              <span
                className={`text-sm ${billingInterval === 'monthly' ? 'text-slate-800 font-medium' : 'text-slate-400'}`}
              >
                Monthly
              </span>
              <button
                onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
                className="relative w-14 h-7 bg-slate-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-primary-500 rounded-full transition-transform ${
                    billingInterval === 'yearly' ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
              <span
                className={`text-sm ${billingInterval === 'yearly' ? 'text-slate-800 font-medium' : 'text-slate-400'}`}
              >
                Yearly
              </span>
              {billingInterval === 'yearly' && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  Save {getSavingsPercent()}
                </span>
              )}
            </div>
          </>
        )}

        {/* Packages/Plans List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : purchaseType === 'one-time' ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-700">Credit Packages</h3>
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative bg-white rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                  pkg.badgeText === 'Most Popular'
                    ? 'border-primary-500'
                    : pkg.badgeText === 'Best Value'
                      ? 'border-accent-500'
                      : 'border-slate-200'
                }`}
              >
                {pkg.badgeText && (
                  <span
                    className={`absolute -top-2.5 left-4 px-2 py-0.5 text-xs font-medium rounded-full ${
                      pkg.badgeText === 'Most Popular'
                        ? 'bg-primary-500 text-white'
                        : 'bg-accent-500 text-white'
                    }`}
                  >
                    {pkg.badgeText}
                  </span>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-800">{pkg.name}</h4>
                    <p className="text-sm text-slate-500">
                      {pkg.credits} credits
                      {pkg.bonusCredits > 0 && (
                        <span className="text-green-600 font-medium"> +{pkg.bonusCredits} bonus</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">${getPricePerCredit(pkg)}/video</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-800">{formatPrice(pkg.priceInCents)}</p>
                    <Button
                      onClick={() => handlePurchase(pkg.id)}
                      size="sm"
                      isLoading={purchasingId === pkg.id}
                      className="mt-2"
                    >
                      Buy
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-700">Subscription Plans</h3>
            {subscriptionPlans.map((plan) => {
              const price = billingInterval === 'monthly' ? plan.monthlyPriceInCents : plan.yearlyPriceInCents;
              const credits = billingInterval === 'monthly' ? plan.monthlyCredits : plan.yearlyCredits;
              const bonus = billingInterval === 'yearly' ? plan.yearlyBonusCredits : 0;
              const isCurrentPlan = subscription?.plan.id === plan.id && subscription?.status === 'ACTIVE';

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                    isCurrentPlan
                      ? 'border-green-500 bg-green-50/50'
                      : plan.badgeText === 'Most Popular'
                        ? 'border-primary-500'
                        : plan.badgeText === 'Best Value'
                          ? 'border-accent-500'
                          : 'border-slate-200'
                  }`}
                >
                  {plan.badgeText && !isCurrentPlan && (
                    <span
                      className={`absolute -top-2.5 left-4 px-2 py-0.5 text-xs font-medium rounded-full ${
                        plan.badgeText === 'Most Popular'
                          ? 'bg-primary-500 text-white'
                          : 'bg-accent-500 text-white'
                      }`}
                    >
                      {plan.badgeText}
                    </span>
                  )}

                  {isCurrentPlan && (
                    <span className="absolute -top-2.5 left-4 px-2 py-0.5 text-xs font-medium rounded-full bg-green-500 text-white">
                      Current Plan
                    </span>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800">{plan.name}</h4>
                      <p className="text-xs text-slate-500 mb-2">{plan.description}</p>
                      <p className="text-sm text-slate-600">
                        {credits} credits
                        {bonus > 0 && (
                          <span className="text-green-600 font-medium"> +{bonus} bonus</span>
                        )}
                        <span className="text-slate-400">
                          /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        ${getSubscriptionPricePerCredit(plan, billingInterval)}/video
                      </p>

                      {/* Features */}
                      <div className="mt-3 space-y-1">
                        {plan.features.slice(0, 3).map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-500">
                            <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-xl font-bold text-slate-800">{formatPrice(price)}</p>
                      <p className="text-xs text-slate-400">
                        /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                      </p>
                      {!isCurrentPlan && (
                        <Button
                          onClick={() => handleSubscribe(plan.id)}
                          size="sm"
                          isLoading={purchasingId === plan.id}
                          className="mt-2"
                          disabled={!!subscription && subscription.status === 'ACTIVE'}
                        >
                          {subscription && subscription.status === 'ACTIVE' ? 'Subscribed' : 'Subscribe'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button onClick={() => setPage('dashboard')} variant="ghost" className="w-full">
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
