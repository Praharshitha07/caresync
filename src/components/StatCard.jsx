import React from 'react';

export default function StatCard({
  title,
  value,
  helperText,
  icon: Icon,
  className = '',
}) {
  return (
    <div
      className={`bg-white rounded-lg border border-brand-border p-5 shadow-card hover:shadow-card-hover transition-shadow duration-150 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
          {title}
        </span>
        {Icon && (
          <div className="p-2 rounded-md bg-teal-50 text-brand-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-brand-text">
          {value}
        </div>
        {helperText && (
          <p className="mt-1 text-xs text-brand-muted flex items-center gap-1">
            {helperText}
          </p>
        )}
      </div>
    </div>
  );
}
