import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
} from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  // Client-side form validation
  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      newErrors.email = 'Hospital email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Please provide a valid institutional email format (e.g., staff@hospital.org).';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 12) {
      newErrors.password = 'Password must be at least 12 characters in length.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const account = await login({ email: email.trim(), password });
      navigate(
        location.state?.from?.pathname ||
          (account.role === 'receptionist' ? '/appointments' : '/dashboard'),
        { replace: true }
      );
    } catch (error) {
      setGeneralError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-brand-primary flex items-center justify-center text-white shadow-md">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-text">
              CareSync
            </h1>
            <p className="text-xs font-semibold text-brand-primary tracking-wide uppercase">
              Hospital Staff Portal
            </p>
          </div>
        </div>

        <p className="mt-3 text-center text-sm font-medium text-brand-muted">
          Better Records. Connected Care.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-card rounded-lg border border-brand-border">
          {/* Security Notice */}
          <div className="mb-6 p-3 bg-slate-50 border border-brand-border rounded-md flex items-start gap-2.5">
            <Shield className="h-4 w-4 text-brand-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-brand-muted leading-relaxed">
              <strong className="text-brand-text font-semibold">Authorized Personnel Only.</strong> Access to patient records and protected medical systems is restricted and monitored.
            </p>
          </div>

          {/* Form Error Banner */}
          {(generalError || authError) && (
            <div
              role="alert"
              className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-brand-error mt-0.5 flex-shrink-0" />
              <span>{generalError || authError}</span>
            </div>
          )}
          {location.state?.notice && (
            <div
              role="status"
              className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800"
            >
              {location.state.notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email Field */}
            <div>
              <label
                htmlFor="staff-email"
                className="block text-xs font-semibold text-brand-text mb-1.5"
              >
                Institutional Email Address
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="staff-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                  }}
                  disabled={isLoading}
                  placeholder="doctor@hospital.org"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={`block w-full pl-9 pr-3 py-2 text-sm rounded-md border text-brand-text placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-colors
                    ${errors.email ? 'border-red-400 focus:border-brand-error' : 'border-brand-border focus:border-brand-primary'}`}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="staff-password"
                  className="block text-xs font-semibold text-brand-text"
                >
                  Password
                </label>
                <span className="text-[11px] text-brand-muted">
                  Account password
                </span>
              </div>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="staff-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  disabled={isLoading}
                  placeholder="Enter your security password"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={`block w-full pl-9 pr-10 py-2 text-sm rounded-md border text-brand-text placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-colors
                    ${errors.password ? 'border-red-400 focus:border-brand-error' : 'border-brand-border focus:border-brand-primary'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Sign In Button */}
            <div className="pt-2">
              <PrimaryButton
                type="submit"
                isLoading={isLoading}
                className="w-full py-2.5 text-sm font-semibold shadow-sm"
              >
                Sign In to Staff Portal
              </PrimaryButton>
            </div>
          </form>

          {/* Institutional Compliance Notice */}
          <div className="mt-6 pt-5 border-t border-brand-border text-center">
            <p className="text-xs text-brand-muted">
              Secure sign-in verified by the CareSync server.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Access is limited to an active staff account provisioned by an administrator.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-brand-muted">
          Need access or password reset? Contact your hospital IT administration desk.
        </p>
      </div>
    </div>
  );
}
