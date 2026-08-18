'use client';

import { AlertTriangle, X } from 'lucide-react';

/**
 * Reusable confirmation dialog that replaces all window.confirm() calls.
 * Matches the Get My Job Sharp brutalist design system.
 *
 * Props:
 *   - open: boolean
 *   - title: string
 *   - message: string
 *   - confirmLabel: string (default "Confirm")
 *   - cancelLabel: string (default "Cancel")
 *   - variant: 'danger' | 'warning' | 'default'
 *   - onConfirm: () => void
 *   - onCancel: () => void
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      iconBg: 'bg-red-500/10',
      button: 'bg-red-500 hover:bg-red-600 text-white',
    },
    warning: {
      icon: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
      button: 'bg-amber-500 hover:bg-amber-600 text-[var(--bg-base)]',
    },
    default: {
      icon: 'text-white',
      iconBg: 'bg-white/10',
      button: 'bg-white hover:bg-gray-200 text-[var(--bg-base)]',
    },
  };

  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-0" onClick={onCancel}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-[400px] bg-[var(--bg-elevated)] border border-white/10 p-8 rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 text-[var(--text-muted)] hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full p-1.5"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${styles.iconBg} border border-white/5`}>
            <AlertTriangle size={28} className={styles.icon} />
          </div>
          <h3 className="text-white font-bold text-xl mb-3 tracking-tight">{title}</h3>
          {message && <p className="text-[var(--text-secondary)] text-[15px] leading-relaxed px-2">{message}</p>}
        </div>

        <div className="flex flex-col gap-3 mt-10">
          <button
            onClick={onConfirm}
            className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all shadow-sm ${styles.button}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3.5 rounded-xl font-bold text-[14px] text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
