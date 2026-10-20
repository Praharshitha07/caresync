import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import PatientsPage from '../pages/PatientsPage';
import PatientFormPage from '../pages/PatientFormPage';
import PatientDetailPage from '../pages/PatientDetailPage';
import MedicalRecordsPage from '../pages/MedicalRecordsPage';
import NewMedicalRecordPage from '../pages/NewMedicalRecordPage';
import AppointmentsPage from '../pages/AppointmentsPage';
import SettingsPage from '../pages/SettingsPage';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';

export default function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Staff Login Route */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        }
      />

      {/* Authenticated Application Shell Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Patients Routes (Notice /patients/new is ordered before /patients/:id) */}
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/new" element={<PatientFormPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="patients/:id/edit" element={<PatientFormPage />} />

        {/* Medical Records Routes */}
        <Route path="medical-records" element={<MedicalRecordsPage />} />
        <Route path="medical-records/new" element={<NewMedicalRecordPage />} />
        {/* Alias for backward compatibility */}
        <Route path="records" element={<Navigate to="/medical-records" replace />} />

        {/* Appointments Route */}
        <Route path="appointments" element={<AppointmentsPage />} />

        {/* Settings Route */}
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
