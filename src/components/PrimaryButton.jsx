import React from 'react';
import { Loader2 } from 'lucide-react';

export default function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  isLoading = false,
  icon: Icon,
  className = '',
  size = 'md',
  ...props
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-medium',
    md: 'px-4 py-2 text-sm font-medium',
    lg: 'px-5 py-2.5 text-base font-medium',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center rounded-md bg-brand-primary text-white
        shadow-sm hover:bg-brand-dark focus-visible:outline focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-brand-primary
        transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size] || sizeClasses.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
