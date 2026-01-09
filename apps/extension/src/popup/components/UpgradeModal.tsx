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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Backdrop - full coverage */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - compact size */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[280px] overflow-hidden animate-scale-in">
        {/* Header - compact */}
        <div className="bg-gradient-to-r from-primary-500 to-accent-500 px-4 py-3 text-center text-white">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          </div>
          <h2 className="text-base font-bold">Out of credits!</h2>
          <p className="text-white/80 text-[11px]">Upgrade to keep creating</p>
        </div>

        {/* Content - compact */}
        <div className="p-3 space-y-2.5">
          {/* Quick Stats */}
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-slate-500">Your balance</p>
            <p className="text-xl font-bold text-slate-800">0 <span className="text-xs font-normal">credits</span></p>
          </div>

          {/* Plans Preview - All 3 Monthly Tiers */}
          <div className="space-y-1">
            <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Monthly Plans</p>

            <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <p className="font-semibold text-slate-800 text-xs">Starter</p>
                <p className="text-[10px] text-slate-500">10 videos/mo</p>
              </div>
              <p className="font-bold text-slate-600 text-xs">$19/mo</p>
            </div>

            <div className="flex items-center justify-between px-2 py-1.5 bg-primary-50 rounded-lg border border-primary-200">
              <div className="flex items-center gap-1">
                <div>
                  <p className="font-semibold text-slate-800 text-xs">Standard</p>
                  <p className="text-[10px] text-slate-500">30 videos/mo</p>
                </div>
                <span className="px-1 py-0.5 bg-primary-500 text-white text-[8px] font-bold rounded">TOP</span>
              </div>
              <p className="font-bold text-primary-600 text-xs">$49/mo</p>
            </div>

            <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <p className="font-semibold text-slate-800 text-xs">Pro</p>
                <p className="text-[10px] text-slate-500">100 videos/mo</p>
              </div>
              <p className="font-bold text-slate-600 text-xs">$99/mo</p>
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-1 pt-0.5">
            <button
              onClick={handleViewPlans}
              className="w-full py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-primary-500/25 hover:shadow-lg transition-all"
            >
              View All Plans
            </button>
            <button
              onClick={onClose}
              className="w-full py-1 text-slate-400 text-[11px] hover:text-slate-600 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
