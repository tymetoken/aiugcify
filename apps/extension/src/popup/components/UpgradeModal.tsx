import { useUIStore } from '../store/uiStore';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const { setPage } = useUIStore();

  if (!isOpen) return null;

  const handleViewPlans = () => {
    onClose();
    setPage('credits');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-accent-500 p-6 text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">You're out of credits!</h2>
          <p className="text-white/80 text-sm mt-1">Upgrade to keep creating videos</p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Quick Stats */}
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-500">Your balance</p>
            <p className="text-3xl font-bold text-slate-800">0 <span className="text-lg font-normal">credits</span></p>
          </div>

          {/* Plans Preview */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Popular options</p>

            <div className="flex items-center justify-between p-3 bg-primary-50 rounded-xl border border-primary-200">
              <div>
                <p className="font-semibold text-slate-800">Standard Plan</p>
                <p className="text-xs text-slate-500">30 videos/month</p>
              </div>
              <p className="font-bold text-primary-600">$49/mo</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="font-semibold text-slate-800">Creator Pack</p>
                <p className="text-xs text-slate-500">25 videos (one-time)</p>
              </div>
              <p className="font-bold text-slate-700">$59</p>
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleViewPlans}
              className="w-full py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-xl transition-all"
            >
              View All Plans
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-slate-500 text-sm hover:text-slate-700 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
