import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const { shortcuts } = useKeyboardShortcuts();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[300px] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-accent-500 px-4 py-3 text-center text-white">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
            </svg>
          </div>
          <h2 className="text-base font-bold">Keyboard Shortcuts</h2>
          <p className="text-white/80 text-[11px]">Press Shift + ? to toggle</p>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 space-y-2">
          {shortcuts.map(({ key, description, available }) => (
            <div
              key={key}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-opacity ${
                available ? 'bg-slate-50' : 'bg-slate-50/50 opacity-50'
              }`}
            >
              <span className="text-sm text-slate-700">{description}</span>
              <kbd className="px-2 py-1 bg-slate-200 rounded text-xs font-mono font-semibold text-slate-600 min-w-[32px] text-center">
                {key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <p className="text-[10px] text-slate-400 text-center mb-2">
            Dimmed shortcuts are not available on this page
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-100 text-slate-600 font-medium text-sm rounded-lg hover:bg-slate-200 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
