import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg text-sm text-brand-muted">
        Verifying secure session...
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page while preserving target path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
