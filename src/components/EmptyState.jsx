import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  title = 'No records found',
  description = 'There is currently no data available to display.',
  icon: Icon = Inbox,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-brand-border bg-white ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-brand-muted mb-3">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-brand-text mb-1">{title}</h3>
      <p className="text-xs text-brand-muted max-w-sm mb-4 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
