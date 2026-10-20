import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchInput({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search by patient name, MRN, or doctor...',
  ariaLabel = 'Search hospital records',
  className = '',
  disabled = false,
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
        <Search className="h-4 w-4" aria-hidden="true" />
      </div>
      <input
        type="search"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="block w-full pl-9 pr-9 py-2 text-sm bg-slate-50 border border-brand-border rounded-md
          text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary
          focus:border-brand-primary focus:bg-white transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
