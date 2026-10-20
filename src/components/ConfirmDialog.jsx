import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed? This action cannot be undone.',
  confirmLabel = 'Delete Record',
  confirmVariant = 'danger',
  isLoading = false,
}) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Focus cancel button by default for safety
      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="fixed inset-0"
        onClick={!isLoading ? onClose : undefined}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-brand-border z-10">
        <div className="flex items-start gap-4">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              confirmVariant === 'danger'
                ? 'bg-red-100 text-brand-error'
                : 'bg-amber-100 text-brand-warning'
            }`}
          >
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3
              id="confirm-dialog-title"
              className="text-base font-bold text-brand-text"
            >
              {title}
            </h3>
            <p
              id="confirm-dialog-desc"
              className="mt-2 text-xs sm:text-sm text-brand-muted leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
          <SecondaryButton
            ref={cancelBtnRef}
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </SecondaryButton>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-md text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              confirmVariant === 'danger'
                ? 'bg-brand-error hover:bg-red-700 focus-visible:outline-red-600 disabled:opacity-50'
                : 'bg-brand-primary hover:bg-brand-dark focus-visible:outline-brand-primary disabled:opacity-50'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
