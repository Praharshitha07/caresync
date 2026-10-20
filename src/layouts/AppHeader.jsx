import React, { useState } from 'react';
import { Menu, Bell, ChevronRight, Info } from 'lucide-react';
import SearchInput from '../components/SearchInput';

export default function AppHeader({
  title = 'Dashboard',
  breadcrumbs = [{ label: 'CareSync', path: '/dashboard' }, { label: 'Dashboard' }],
  onOpenMobileSidebar,
  currentUser,
}) {
  const [searchValue, setSearchValue] = useState('');
  const [showNotificationNote, setShowNotificationNote] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-brand-border sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-md text-brand-muted hover:text-brand-text hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-colors"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb & Title */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-brand-muted">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label}>
              {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
              <span
                className={
                  idx === breadcrumbs.length - 1
                    ? 'font-semibold text-brand-text'
                    : 'hover:text-brand-primary transition-colors'
                }
              >
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Middle: Search interface placeholder */}
      <div className="flex-1 max-w-md mx-2 hidden md:block">
        <SearchInput
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onClear={() => setSearchValue('')}
          placeholder="Search patient records, ID, or appointments..."
          ariaLabel="Search hospital database"
        />
      </div>

      {/* Right: Notifications & Staff Profile */}
      <div className="flex items-center gap-3">
        {/* Notification Icon */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotificationNote((prev) => !prev)}
            className="p-2 text-slate-600 hover:text-brand-primary hover:bg-slate-100 rounded-full transition-colors relative"
            aria-label="Staff notifications (3 unread)"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-brand-primary rounded-full ring-2 ring-white" />
          </button>

          {/* Notification placeholder banner */}
          {showNotificationNote && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-card-hover border border-brand-border p-3 text-xs z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-brand-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-brand-text">Staff Notifications</p>
                  <p className="text-brand-muted mt-0.5">
                    Live notification dispatch will be integrated with the Express event services in later phases.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User initials & name */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-brand-border">
          <div className="h-9 w-9 rounded-full bg-teal-50 border border-teal-200 text-brand-primary font-semibold text-xs flex items-center justify-center shadow-sm">
            {currentUser?.displayName
              ?.split(/\s+/)
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'CS'}
          </div>
          <div className="hidden xl:block text-left">
            <p className="text-xs font-semibold text-brand-text leading-tight">
              {currentUser?.displayName || 'Authorized Staff'}
            </p>
            <p className="text-[11px] text-brand-muted leading-tight">
              {currentUser?.role || 'Staff Portal'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
