import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import SecondaryButton from './SecondaryButton';

export default function ErrorState({
  title = 'Failed to load records',
  message = 'An unexpected error occurred while communicating with the hospital data service.',
  onRetry,
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50/50 p-6 text-center ${className}`}
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-brand-error mb-3">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-brand-text mb-1">{title}</h3>
      <p className="text-xs text-brand-muted max-w-md mx-auto mb-4 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <SecondaryButton
          size="sm"
          onClick={onRetry}
          icon={RotateCcw}
          className="mx-auto"
        >
          Retry Request
        </SecondaryButton>
      )}
    </div>
  );
}
