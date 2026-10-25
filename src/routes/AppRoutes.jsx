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
import DoctorsPage from '../pages/DoctorsPage';
import StaffPage from '../pages/StaffPage';
import ReceptionistPatientEditPage from '../pages/ReceptionistPatientEditPage';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import { useAuth } from '../context/AuthContext';

const CLINICAL_ROLES = ['admin', 'doctor', 'clinician', 'nurse'];
const PATIENT_READ_ROLES = [...CLINICAL_ROLES, 'records_staff'];
const STAFF_ROLES = [...PATIENT_READ_ROLES, 'receptionist'];
const PATIENT_CREATE_ROLES = [...CLINICAL_ROLES, 'receptionist'];

export default function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const defaultPath = user?.role === 'receptionist' ? '/appointments' : '/dashboard';

  return (
    <Routes>
      {/* Public Staff Login Route */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to={defaultPath} replace /> : <LoginPage />
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
        <Route index element={<Navigate to={defaultPath} replace />} />
        <Route path="dashboard" element={
          <RoleRoute allowedRoles={PATIENT_READ_ROLES}><DashboardPage /></RoleRoute>
        } />

        {/* Patients Routes (Notice /patients/new is ordered before /patients/:id) */}
        <Route path="patients" element={
          <RoleRoute allowedRoles={STAFF_ROLES}><PatientsPage /></RoleRoute>
        } />
        <Route path="patients/new" element={
          <RoleRoute allowedRoles={PATIENT_CREATE_ROLES}><PatientFormPage /></RoleRoute>
        } />
        <Route path="patients/:id" element={
          <RoleRoute allowedRoles={PATIENT_READ_ROLES}><PatientDetailPage /></RoleRoute>
        } />
        <Route path="patients/:id/edit" element={
          <RoleRoute allowedRoles={CLINICAL_ROLES}><PatientFormPage /></RoleRoute>
        } />
        <Route path="patients/:id/edit-demographics" element={
          <RoleRoute allowedRoles={['receptionist']}><ReceptionistPatientEditPage /></RoleRoute>
        } />

        {/* Medical Records Routes */}
        <Route path="medical-records" element={
          <RoleRoute allowedRoles={PATIENT_READ_ROLES}><MedicalRecordsPage /></RoleRoute>
        } />
        <Route path="medical-records/new" element={
          <RoleRoute allowedRoles={CLINICAL_ROLES}><NewMedicalRecordPage /></RoleRoute>
        } />
        {/* Alias for backward compatibility */}
        <Route path="records" element={<Navigate to="/medical-records" replace />} />

        {/* Appointments Route */}
        <Route path="appointments" element={
          <RoleRoute allowedRoles={STAFF_ROLES}><AppointmentsPage /></RoleRoute>
        } />
        <Route path="doctors" element={
          <RoleRoute allowedRoles={['admin']}><DoctorsPage /></RoleRoute>
        } />
        <Route path="staff" element={
          <RoleRoute allowedRoles={['admin']}><StaffPage /></RoleRoute>
        } />

        {/* Settings Route */}
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
