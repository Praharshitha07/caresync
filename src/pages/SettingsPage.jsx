import React, { useState } from 'react';
import {
  Settings,
  User,
  Shield,
  Lock,
  CheckCircle2,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { user, clearSession } = useAuth();
  const navigate = useNavigate();

  const [preferences, setPreferences] = useState({
    emailAlerts: true,
    urgentCasePings: true,
    autoTimeout: '30',
    defaultDepartment: 'General Medicine & Acute Care',
  });
  const [prefSavedNotice, setPrefSavedNotice] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleTogglePref = (key) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');

    const errors = {};
    if (!passwords.currentPassword) errors.currentPassword = 'Current password is required.';
    if (passwords.newPassword.length < 12) {
      errors.newPassword = 'Password must be at least 12 characters.';
    } else if (new TextEncoder().encode(passwords.newPassword).length > 72) {
      errors.newPassword = 'Password must be no more than 72 UTF-8 bytes.';
    }
    if (!passwords.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password.';
    } else if (passwords.newPassword !== passwords.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsChangingPassword(true);
    try {
      await changePassword(passwords);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      clearSession();
      navigate('/login', {
        replace: true,
        state: { notice: 'Password changed. Sign in again with your new password.' },
      });
    } catch (error) {
      const fieldErrors = Object.fromEntries(
        (error.errors || []).map(({ field, message }) => [field, message])
      );
      setPasswordErrors(fieldErrors);
      setPasswordError(error.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const renderPasswordField = (field, label, autoComplete, helperText) => (
    <div>
      <label htmlFor={`password-${field}`} className="block text-xs font-semibold text-brand-text mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={`password-${field}`}
          type={visiblePasswords[field] ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={passwords[field]}
          onChange={(event) => {
            setPasswords((previous) => ({ ...previous, [field]: event.target.value }));
            setPasswordErrors((previous) => ({ ...previous, [field]: '' }));
            setPasswordError('');
          }}
          maxLength={72}
          aria-invalid={Boolean(passwordErrors[field])}
          aria-describedby={passwordErrors[field] ? `password-${field}-error` : undefined}
          className="block w-full rounded-md border border-brand-border py-2 pl-3 pr-10 text-sm text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
        <button
          type="button"
          onClick={() =>
            setVisiblePasswords((previous) => ({
              ...previous,
              [field]: !previous[field],
            }))
          }
          aria-label={`${visiblePasswords[field] ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={Boolean(visiblePasswords[field])}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-brand-muted hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
        >
          {visiblePasswords[field] ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {passwordErrors[field] && (
        <p id={`password-${field}-error`} className="mt-1 text-xs text-brand-error" role="alert">
          {passwordErrors[field]}
        </p>
      )}
      {helperText && <p className="mt-1 text-xs text-brand-muted">{helperText}</p>}
    </div>
  );

  const handleSavePreferences = (e) => {
    e.preventDefault();
    setPrefSavedNotice(true);
    setTimeout(() => setPrefSavedNotice(false), 3000);
  };

  return (
    <PageContainer
      title="System Settings"
      subtitle="Staff profile credentials, clinical station preferences, and hospital security configurations."
    >
      {/* Notice regarding backend integration */}
      <div className="mb-6 p-3 bg-white border border-brand-border rounded-lg shadow-card flex items-start gap-2.5 text-xs text-brand-muted">
        <Info className="h-4 w-4 text-brand-primary flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-brand-text font-semibold">Institutional Security Notice:</strong>{' '}
          Your displayed account role is assigned by an administrator and is enforced by the server.
        </div>
      </div>

      {prefSavedNotice && (
        <div
          role="status"
          className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-xs text-emerald-800 animate-in fade-in"
        >
          <CheckCircle2 className="h-5 w-5 text-brand-success flex-shrink-0" />
          <span className="font-medium">Local session preferences updated for current device.</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Staff Profile Summary */}
        <div className="bg-white rounded-lg border border-brand-border p-6 shadow-card">
          <div className="flex items-center gap-2 pb-3 mb-5 border-b border-brand-border">
            <User className="h-4 w-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-brand-text uppercase tracking-wide">
              Staff Profile Summary
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-teal-50 border-2 border-teal-200 text-brand-primary font-bold text-xl flex items-center justify-center flex-shrink-0">
              {user?.displayName
                ?.split(/\s+/)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'CS'}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-brand-muted block font-medium">Full Name:</span>
                <span className="text-sm font-bold text-brand-text block mt-0.5">
                  {user?.displayName}
                </span>
                <span className="text-slate-500">CareSync staff account</span>
              </div>
              <div>
                <span className="text-brand-muted block font-medium">Institutional Email:</span>
                <span className="font-semibold text-brand-text block mt-0.5">
                  {user?.email}
                </span>
                <span className="text-emerald-700 font-medium">Verified Staff</span>
              </div>
              <div>
                <span className="text-brand-muted block font-medium">Authorized Role:</span>
                <span className="font-semibold text-brand-text block mt-0.5">
                  {user?.role}
                </span>
                <span className="text-slate-500">Assigned by an administrator</span>
              </div>
              <div>
                <span className="text-brand-muted block font-medium">License / ID:</span>
                <span className="font-mono text-brand-text block mt-0.5 font-semibold">
                  Not configured
                </span>
                <span className="text-slate-500">Not stored in CareSync</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Account Preferences */}
        <div className="bg-white rounded-lg border border-brand-border p-6 shadow-card">
          <div className="flex items-center gap-2 pb-3 mb-5 border-b border-brand-border">
            <Settings className="h-4 w-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-brand-text uppercase tracking-wide">
              Station & Notification Preferences
            </h2>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <span className="font-semibold text-brand-text block">Clinical Alert Dispatches</span>
                <span className="text-brand-muted">Receive critical inpatient lab result flags and triage alerts</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailAlerts}
                onChange={() => handleTogglePref('emailAlerts')}
                className="h-4 w-4 text-brand-primary rounded border-brand-border focus:ring-brand-primary"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <span className="font-semibold text-brand-text block">Appointment Schedule Reminders</span>
                <span className="text-brand-muted">Receive 15-minute advance notifications for consults</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.urgentCasePings}
                onChange={() => handleTogglePref('urgentCasePings')}
                className="h-4 w-4 text-brand-primary rounded border-brand-border focus:ring-brand-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-semibold text-brand-text mb-1">
                  Session Inactivity Auto-Lock
                </label>
                <select
                  value={preferences.autoTimeout}
                  onChange={(e) => setPreferences((p) => ({ ...p, autoTimeout: e.target.value }))}
                  className="block w-full py-2 px-3 rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary text-xs"
                >
                  <option value="15">15 minutes (Strict HIPAA)</option>
                  <option value="30">30 minutes (Standard Hospital)</option>
                  <option value="60">60 minutes (Clinical Ward)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-brand-text mb-1">
                  Active Clinical Theme
                </label>
                <div className="py-2 px-3 rounded-md border border-brand-border bg-slate-50 text-slate-700 text-xs flex items-center justify-between">
                  <span className="font-medium">Clinical Teal Pro</span>
                  <span className="h-3 w-3 rounded-full bg-brand-primary" />
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <PrimaryButton type="submit" size="sm">
                Save Preferences
              </PrimaryButton>
            </div>
          </form>
        </div>

        {/* Section 3: Password & Security */}
        <div className="bg-white rounded-lg border border-brand-border p-6 shadow-card">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
            <Lock className="h-4 w-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-brand-text uppercase tracking-wide">
              Hospital Security Credentials
            </h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-2xl">
            <p className="text-xs text-brand-muted">
              Verify your current password. Your password must be at least 12 characters;
              changing it will sign you out of all devices.
            </p>
            {passwordError && (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-brand-error" role="alert">
                {passwordError}
              </p>
            )}
            {renderPasswordField('currentPassword', 'Current password', 'current-password')}
            {renderPasswordField(
              'newPassword',
              'New password',
              'new-password',
              'Use at least 12 characters (maximum 72 UTF-8 bytes).'
            )}
            {renderPasswordField('confirmPassword', 'Confirm new password', 'new-password')}
            <div className="pt-1">
              <PrimaryButton type="submit" size="sm" isLoading={isChangingPassword}>
                Change password
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
