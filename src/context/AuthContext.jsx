import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  authenticateUser,
  endSession,
  getCurrentUser,
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const isAuthenticated = Boolean(user);

  useEffect(() => {
    let active = true;
    const expireSession = () => {
      if (!active) return;
      setUser(null);
      setAuthError('Your session expired. Sign in again to continue.');
    };
    window.addEventListener('caresync:session-expired', expireSession);
    getCurrentUser()
      .then((response) => {
        if (active) setUser(response.data.user);
      })
      .catch((error) => {
        if (!active) return;
        setUser(null);
        if (error.status !== 401) {
          setAuthError('Unable to verify the secure session. Check the API connection and try signing in.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener('caresync:session-expired', expireSession);
    };
  }, []);

  const login = async (credentials) => {
    const response = await authenticateUser(credentials);
    setUser(response.data.user);
    setAuthError('');
    return response.data.user;
  };

  const logout = async () => {
    try {
      await endSession();
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    setUser(null);
    setAuthError('');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        isLoading,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
