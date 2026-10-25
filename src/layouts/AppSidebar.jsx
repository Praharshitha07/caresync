import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Settings,
  Stethoscope,
  LogOut,
  Activity,
  X,
  ShieldCheck,
} from 'lucide-react';

export default function AppSidebar({
  mobileOpen = false,
  onCloseMobile,
  onLogout,
  currentUser,
}) {
  const navItems = [
    ...(currentUser?.role !== 'receptionist'
      ? [{ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }]
      : []),
    { name: 'Patients', path: '/patients', icon: Users },
    ...(currentUser?.role !== 'receptionist'
      ? [{ name: 'Medical Records', path: '/medical-records', icon: FileText }]
      : []),
    { name: 'Appointments', path: '/appointments', icon: Calendar },
    ...(currentUser?.role === 'admin'
      ? [
          { name: 'Doctors', path: '/doctors', icon: Stethoscope },
          { name: 'Staff', path: '/staff', icon: Users },
        ]
      : []),
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container - Deep Clinical Teal Pro */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-brand-sidebar text-white flex flex-col justify-between
          transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto shadow-lg lg:shadow-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Top Header / Brand */}
        <div>
          <div className="h-16 px-5 flex items-center justify-between border-b border-teal-800/80 bg-brand-sidebar-dark/40">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-sm">
                <Activity className="h-5 w-5 text-teal-200" />
              </div>
              <div>
                <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                  CareSync
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-teal-800/70 text-teal-200 border border-teal-700/60">
                    Pro
                  </span>
                </span>
                <p className="text-[11px] text-teal-200/70 leading-tight">
                  Hospital Portal
                </p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded-md text-teal-200 hover:text-white hover:bg-brand-sidebar-hover transition-colors"
              aria-label="Close navigation sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `group flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-sidebar-hover text-white font-semibold shadow-sm border-l-4 border-teal-300 pl-2.5'
                        : 'text-teal-100/90 hover:text-white hover:bg-brand-sidebar-hover/80'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4.5 w-4.5 flex-shrink-0 text-teal-200 group-hover:text-white transition-colors" aria-hidden="true" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-medium text-teal-200 bg-teal-800 px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Staff Profile, Role, & Logout */}
        <div className="p-3 border-t border-teal-800/80 bg-brand-sidebar-dark/70">
          <div className="flex items-center gap-3 p-2.5 rounded-md bg-[#134E4A]/80 border border-teal-700/50">
            <div className="h-9 w-9 rounded-full bg-teal-700 border border-teal-500/40 flex items-center justify-center text-white font-bold text-xs shadow-inner">
              {currentUser?.displayName
                ?.split(/\s+/)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'CS'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser?.displayName || 'Staff Member'}
              </p>
              <p className="text-[11px] text-teal-200 truncate flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-3 w-3 text-emerald-400 inline flex-shrink-0" />
                <span>{currentUser?.role || 'Authorized Personnel'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="mt-2.5 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-teal-200 hover:text-white hover:bg-red-500/20 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
