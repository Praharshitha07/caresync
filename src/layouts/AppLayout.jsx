import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setLogoutError('The session could not be ended. Please try again.');
    }
  };

  // Derive breadcrumbs and title from route
  const getHeaderInfo = () => {
    const path = location.pathname;

    if (path === '/patients/new') {
      return {
        title: 'Register Patient',
        breadcrumbs: [
          { label: 'CareSync', path: '/dashboard' },
          { label: 'Patients', path: '/patients' },
          { label: 'Register' },
        ],
      };
    }

    if (path.startsWith('/patients/') && path.endsWith('/edit')) {
      return {
        title: 'Edit Patient',
        breadcrumbs: [
          { label: 'CareSync', path: '/dashboard' },
          { label: 'Patients', path: '/patients' },
          { label: 'Edit' },
        ],
      };
    }

    if (path.startsWith('/patients/')) {
      return {
        title: 'Patient Dossier',
        breadcrumbs: [
          { label: 'CareSync', path: '/dashboard' },
          { label: 'Patients', path: '/patients' },
          { label: 'Profile' },
        ],
      };
    }

    if (path.startsWith('/patients')) {
      return {
        title: 'Patients Directory',
        breadcrumbs: [{ label: 'CareSync', path: '/dashboard' }, { label: 'Patients' }],
      };
    }

    if (path === '/medical-records/new') {
      return {
        title: 'Add Medical Record',
        breadcrumbs: [
          { label: 'CareSync', path: '/dashboard' },
          { label: 'Medical Records', path: '/medical-records' },
          { label: 'New Record' },
        ],
      };
    }

    if (path.startsWith('/medical-records') || path.startsWith('/records')) {
      return {
        title: 'Medical Records',
        breadcrumbs: [{ label: 'CareSync', path: '/dashboard' }, { label: 'Medical Records' }],
      };
    }

    if (path.startsWith('/appointments')) {
      return {
        title: 'Appointments Schedule',
        breadcrumbs: [{ label: 'CareSync', path: '/dashboard' }, { label: 'Appointments' }],
      };
    }

    if (path.startsWith('/settings')) {
      return {
        title: 'System Settings',
        breadcrumbs: [{ label: 'CareSync', path: '/dashboard' }, { label: 'Settings' }],
      };
    }

    return {
      title: 'Hospital Dashboard',
      breadcrumbs: [{ label: 'CareSync', path: '/dashboard' }, { label: 'Dashboard' }],
    };
  };

  const { title, breadcrumbs } = getHeaderInfo();

  return (
    <div className="min-h-screen bg-brand-bg flex">
      {/* App Sidebar */}
      <AppSidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onLogout={handleLogout}
        currentUser={user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader
          title={title}
          breadcrumbs={breadcrumbs}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          currentUser={user}
        />

        <div className="flex-1 overflow-y-auto">
          {logoutError && (
            <p role="alert" className="px-6 pt-4 text-sm text-brand-error">
              {logoutError}
            </p>
          )}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
