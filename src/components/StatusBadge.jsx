import React from 'react';

const VARIANT_STYLES = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  info: 'bg-teal-50 text-teal-800 border-teal-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  muted: 'bg-gray-100 text-gray-600 border-gray-200',
};

const DOT_STYLES = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-teal-600',
  neutral: 'bg-slate-400',
  muted: 'bg-gray-400',
};

export default function StatusBadge({
  children,
  variant = 'neutral',
  showDot = true,
  className = '',
}) {
  const badgeClasses = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;
  const dotClasses = DOT_STYLES[variant] || DOT_STYLES.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClasses} ${className}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotClasses}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
