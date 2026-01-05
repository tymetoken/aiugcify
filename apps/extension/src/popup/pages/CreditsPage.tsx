import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { apiClient } from '@/shared/api-client';
import { Button } from '../components/Button';
import type { CreditPackage } from '@aiugcify/shared-types';

export function CreditsPage() {
  const { user, refreshUser } = useAuthStore();
  const { setPage } = useUIStore();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const { packages } = await apiClient.getPackages();
      setPackages(packages);
    } catch (error) {
      console.error('Failed to load packages:', error);
    }
    setIsLoading(false);
  };

  const handlePurchase = async (packageId: string) => {
    setPurchasingId(packageId);
    try {
      const { checkoutUrl } = await apiClient.createCheckout(packageId);
      window.open(checkoutUrl, '_blank');

      // Refresh user data after a delay (for when they come back)
      setTimeout(() => {
        refreshUser();
      }, 5000);
    } catch (error) {
      console.error('Failed to create checkout:', error);
    }
    setPurchasingId(null);
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const getPricePerCredit = (pkg: CreditPackage) => {
    const totalCredits = pkg.credits + pkg.bonusCredits;
    return (pkg.priceInCents / 100 / totalCredits).toFixed(2);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Current Balance */}
      <div className="bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl p-4 text-white">
        <p className="text-sm opacity-90">Current Balance</p>
        <p className="text-3xl font-bold mt-1">{user?.creditBalance || 0} Credits</p>
        <p className="text-sm opacity-75 mt-2">1 credit = 1 video generation</p>
      </div>

      {/* Packages */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-3">Buy Credits</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative bg-white rounded-xl border-2 p-4 ${
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
                        <span className="text-green-600"> +{pkg.bonusCredits} bonus</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      ${getPricePerCredit(pkg)}/video
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-800">
                      {formatPrice(pkg.priceInCents)}
                    </p>
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
        )}
      </div>

      <Button onClick={() => setPage('dashboard')} variant="ghost" className="w-full">
        Back to Dashboard
      </Button>
    </div>
  );
}
