import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { HospitalDataProvider } from './context/HospitalDataContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HospitalDataProvider>
          <AppRoutes />
        </HospitalDataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
