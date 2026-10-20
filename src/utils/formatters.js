/**
 * Utility functions for CareSync formatting
 */

export function formatDate(dateString) {
  if (!dateString) return '—';
  return dateString;
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}
