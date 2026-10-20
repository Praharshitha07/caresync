import React from 'react';

export default function PageContainer({
  title,
  subtitle,
  actions,
  children,
  className = '',
}) {
  return (
    <div className={`p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full ${className}`}>
      {(title || subtitle || actions) && (
        <header className="mb-6 pb-4 border-b border-brand-border/60 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && (
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-text">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1 text-xs sm:text-sm text-brand-muted">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2.5 flex-wrap">
              {actions}
            </div>
          )}
        </header>
      )}
      <main>{children}</main>
    </div>
  );
}
