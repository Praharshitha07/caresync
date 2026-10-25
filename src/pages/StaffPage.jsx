import React, { useEffect, useState } from 'react';
import { Plus, Search, ShieldCheck, UserRound } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import {
  createStaffAccount,
  listStaffAccounts,
  updateStaffAccountStatus,
} from '../services/api';

const ROLE_LABELS = {
  admin: 'Administrator',
  doctor: 'Doctor',
  nurse: 'Nurse',
  receptionist: 'Receptionist',
  clinician: 'Clinician (legacy)',
  records_staff: 'Records staff (legacy)',
};

const EMPTY_FORM = {
  email: '',
  displayName: '',
  role: 'nurse',
  specialty: '',
  department: '',
  phone: '',
  professionalIdentifier: '',
  password: '',
  confirmPassword: '',
};

export default function StaffPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formValidationErrors, setFormValidationErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!isAdmin) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listStaffAccounts({ signal: controller.signal })
      .then((accounts) => {
        setStaff(accounts);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isAdmin, reloadKey]);

  const filteredStaff = staff.filter((account) =>
    `${account.displayName} ${account.email} ${account.role} ${account.doctor?.name || ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setFormError('');
    setFormValidationErrors([]);
    setIsFormOpen(true);
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFormValidationErrors([]);
    const {
      specialty,
      department,
      phone,
      professionalIdentifier,
      ...account
    } = formData;
    try {
      await createStaffAccount({
        ...account,
        ...(formData.role === 'doctor'
          ? {
              doctorProfile: {
                specialty,
                ...(department.trim() ? { department } : {}),
                ...(phone.trim() ? { phone } : {}),
                ...(professionalIdentifier.trim() ? { professionalIdentifier } : {}),
              },
            }
          : {}),
      });
      setIsFormOpen(false);
      setFormData(EMPTY_FORM);
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      setFormError(requestError.message);
      setFormValidationErrors(requestError.errors || []);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (account) => {
    setActionError('');
    try {
      await updateStaffAccountStatus(account.id, !account.isActive);
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      setActionError(requestError.message);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer title="Access Restricted">
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Staff account management is available to administrators only.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Staff Management"
      subtitle="Provision individual staff sign-ins and manage account access."
      actions={<PrimaryButton icon={Plus} onClick={openCreate}>Create Staff Account</PrimaryButton>}
    >
      <div className="mb-5 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
        Initial passwords are hashed by the server and never returned. Convey credentials
        to the staff member through a separate secure channel.
      </div>
      {actionError && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {actionError}
        </p>
      )}
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-brand-border bg-white p-3 shadow-card">
        <Search className="h-4 w-4 text-brand-muted" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search staff name, email, role, or linked doctor..."
          aria-label="Search staff accounts"
          className="w-full border-0 text-sm text-brand-text outline-none focus:ring-0"
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-brand-border bg-white shadow-card">
        {error ? (
          <div className="p-6"><ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} /></div>
        ) : loading ? (
          <LoadingState message="Loading staff accounts..." />
        ) : filteredStaff.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={UserRound}
              title={search ? 'No Accounts Match This Search' : 'No Staff Accounts'}
              description={search ? 'Try another name, email, role, or doctor profile.' : 'Create an individual account for each authorized staff member.'}
              action={!search ? <PrimaryButton size="sm" icon={Plus} onClick={openCreate}>Create First Account</PrimaryButton> : null}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-border text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-brand-muted">
                <tr>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Doctor Profile</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {filteredStaff.map((account) => (
                  <tr key={account.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-brand-text">{account.displayName}</p>
                      <p className="text-xs text-brand-muted">{account.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{ROLE_LABELS[account.role] || account.role}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {account.doctor?.name || (account.role === 'doctor' ? 'Profile unavailable' : '—')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        account.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleActive(account)}
                        disabled={account.id === user.id}
                        className="text-xs font-semibold text-brand-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        title={account.id === user.id ? 'You cannot deactivate your own account' : undefined}
                      >
                        {account.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => !saving && setIsFormOpen(false)}
        title="Create Staff Account"
        subtitle="Each staff member signs in with an individual CareSync account."
      >
        <form onSubmit={submitCreate} className="space-y-4">
          {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{formError}</p>}
          {formValidationErrors.length > 0 && (
            <ul className="list-disc space-y-1 rounded-md border border-red-200 bg-red-50 p-3 pl-7 text-xs text-red-800">
              {formValidationErrors.map(({ field, message }, index) => (
                <li key={`${field}-${index}`}>
                  {field || 'Request'}: {message}
                </li>
              ))}
            </ul>
          )}
          <label className="block text-xs font-semibold text-brand-text">
            Full name
            <input required maxLength={120} value={formData.displayName} onChange={(event) => setFormData({ ...formData, displayName: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="block text-xs font-semibold text-brand-text">
            Staff email
            <input required type="email" maxLength={254} autoComplete="off" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="block text-xs font-semibold text-brand-text">
            Role
            <select
              value={formData.role}
              onChange={(event) => setFormData({
                ...formData,
                role: event.target.value,
              })}
              className="mt-1 block w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-normal"
            >
              <option value="admin">Administrator</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="receptionist">Receptionist</option>
              <option value="clinician">Clinician (legacy role)</option>
              <option value="records_staff">Records staff (legacy role)</option>
            </select>
          </label>
          {formData.role === 'doctor' && (
            <div className="space-y-3 rounded-md border border-brand-border bg-slate-50 p-3">
              <label className="block text-xs font-semibold text-brand-text">
                Specialty
                <input
                  required
                  maxLength={120}
                  value={formData.specialty}
                  onChange={(event) => setFormData({ ...formData, specialty: event.target.value })}
                  placeholder="Enter specialty"
                  className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-semibold text-brand-text">
                Department (optional)
                <input
                  maxLength={120}
                  value={formData.department}
                  onChange={(event) => setFormData({ ...formData, department: event.target.value })}
                  placeholder="Enter department"
                  className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-semibold text-brand-text">
                Contact phone (optional)
                <input
                  type="tel"
                  maxLength={40}
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-semibold text-brand-text">
                Professional identifier (optional)
                <input
                  maxLength={40}
                  value={formData.professionalIdentifier}
                  onChange={(event) => setFormData({ ...formData, professionalIdentifier: event.target.value })}
                  className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal"
                />
              </label>
              <p className="text-xs font-normal text-brand-muted">
                This creates a new doctor profile linked to this login account. The account email is also used as the profile contact email.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-brand-text">
              Initial password (12+ characters)
              <input required minLength={12} maxLength={72} type="password" autoComplete="new-password" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
            </label>
            <label className="block text-xs font-semibold text-brand-text">
              Confirm initial password
              <input required minLength={12} maxLength={72} type="password" autoComplete="new-password" value={formData.confirmPassword} onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
            </label>
          </div>
          <p className="text-xs text-brand-muted">
            The server stores only a password hash. Password changes are admin-assisted through the existing reset workflow.
          </p>
          <div className="flex justify-end gap-2 border-t border-brand-border pt-4">
            <SecondaryButton onClick={() => setIsFormOpen(false)} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton
              type="submit"
              isLoading={saving}
              icon={ShieldCheck}
            >
              Create Account
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
