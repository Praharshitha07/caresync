import React from 'react';
import { useAuth } from '../context/AuthContext';
import PageContainer from '../components/PageContainer';

export default function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();
  if (!allowedRoles.includes(user?.role)) {
    return (
      <PageContainer title="Access Denied">
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Your account does not have permission to view this page.
        </div>
      </PageContainer>
    );
  }
  return children;
}
