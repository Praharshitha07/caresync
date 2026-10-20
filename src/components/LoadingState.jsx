import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingState({
  message = 'Loading hospital records...',
  className = '',
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-12 text-center ${className}`}
    >
      <Loader2 className="h-8 w-8 animate-spin text-brand-primary mb-3" aria-hidden="true" />
      <p className="text-sm font-medium text-brand-text">{message}</p>
      <p className="text-xs text-brand-muted mt-1">Please wait a moment</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
