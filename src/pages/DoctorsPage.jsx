import React, { useEffect, useState } from 'react';
import { Plus, Search, Stethoscope, UserRoundPen } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import Modal from '../components/Modal';
import {
  createDoctor,
  listDoctors,
  listStaffAccounts,
  updateDoctor,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  name: '',
  specialty: '',
  department: '',
  email: '',
  phone: '',
  professionalIdentifier: '',
};

export default function DoctorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [doctors, setDoctors] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!isAdmin) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      listDoctors({ includeInactive: 'true', search }, { signal: controller.signal }),
      listStaffAccounts({ signal: controller.signal }),
    ])
      .then(([profiles, accounts]) => {
        setDoctors(profiles);
        setStaffAccounts(accounts);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isAdmin, reloadKey, search]);

  const accountByDoctor = new Map(
    staffAccounts
      .filter((account) => account.role === 'doctor' && account.doctor?.id)
      .map((account) => [account.doctor.id, account])
  );

  const openCreate = () => {
    setEditingDoctor(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEdit = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name,
      specialty: doctor.specialty,
      department: doctor.department,
      email: doctor.email,
      phone: doctor.phone,
      professionalIdentifier: doctor.professionalIdentifier,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const saveDoctor = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...formData,
        ...(editingDoctor ? {} : { active: true }),
      };
      if (editingDoctor) {
        await updateDoctor(editingDoctor.id, payload);
      } else {
        await createDoctor(payload);
      }
      setIsFormOpen(false);
      setEditingDoctor(null);
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (doctor) => {
    setActionError('');
    try {
      await updateDoctor(doctor.id, { active: !doctor.active });
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      setActionError(requestError.message);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer title="Access Restricted">
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Doctor profile management is available to administrators only.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Doctor Management"
      subtitle="Manage clinician profiles and their availability for patient and appointment assignment."
      actions={<PrimaryButton icon={Plus} onClick={openCreate}>Add Doctor</PrimaryButton>}
    >
      {actionError && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {actionError}
        </p>
      )}

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-brand-border bg-white p-3 shadow-card">
        <Search className="h-4 w-4 text-brand-muted" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search doctor name, specialty, or department..."
          aria-label="Search doctors"
          className="w-full border-0 text-sm text-brand-text outline-none focus:ring-0"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-brand-border bg-white shadow-card">
        {error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
          </div>
        ) : loading ? (
          <LoadingState message="Loading doctor profiles..." />
        ) : doctors.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Stethoscope}
              title={search ? 'No Doctors Match This Search' : 'No Doctor Profiles'}
              description={search
                ? 'Try another name, specialty, or department.'
                : 'Add a doctor profile to make active clinicians available for patient and appointment assignment.'}
              action={!search ? (
                <PrimaryButton size="sm" icon={Plus} onClick={openCreate}>Add First Doctor</PrimaryButton>
              ) : null}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-border text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-brand-muted">
                <tr>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Specialty / Department</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Login Account</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {doctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-brand-text">{doctor.name}</p>
                      {doctor.professionalIdentifier && (
                        <p className="font-mono text-[11px] text-brand-muted">{doctor.professionalIdentifier}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <p>{doctor.specialty}</p>
                      {doctor.department && <p className="text-brand-muted">{doctor.department}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {doctor.email && <p>{doctor.email}</p>}
                      {doctor.phone && <p>{doctor.phone}</p>}
                      {!doctor.email && !doctor.phone && <span className="text-brand-muted">Not provided</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {accountByDoctor.get(doctor.id)?.email || 'Not linked'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        doctor.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {doctor.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <SecondaryButton size="sm" icon={UserRoundPen} onClick={() => openEdit(doctor)}>
                          Edit
                        </SecondaryButton>
                        <button
                          type="button"
                          onClick={() => toggleActive(doctor)}
                          className="text-xs font-semibold text-brand-primary hover:underline"
                        >
                          {doctor.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
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
        onClose={() => setIsFormOpen(false)}
        title={editingDoctor ? 'Edit Doctor Profile' : 'Add Doctor Profile'}
        subtitle="Only administrators can create or update clinician profiles."
      >
        <form onSubmit={saveDoctor} className="space-y-4">
          {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{formError}</p>}
          <label className="block text-xs font-semibold text-brand-text">
            Full name <span className="text-brand-error">*</span>
            <input required maxLength={120} value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="block text-xs font-semibold text-brand-text">
            Specialty <span className="text-brand-error">*</span>
            <input required maxLength={120} value={formData.specialty} onChange={(event) => setFormData({ ...formData, specialty: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="block text-xs font-semibold text-brand-text">
            Department
            <input maxLength={120} value={formData.department} onChange={(event) => setFormData({ ...formData, department: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-brand-text">
              Professional email
              <input type="email" maxLength={254} value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
            </label>
            <label className="block text-xs font-semibold text-brand-text">
              Contact phone
              <input type="tel" maxLength={40} value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
            </label>
          </div>
          <label className="block text-xs font-semibold text-brand-text">
            Professional identifier
            <input maxLength={40} value={formData.professionalIdentifier} onChange={(event) => setFormData({ ...formData, professionalIdentifier: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <div className="flex justify-end gap-2 border-t border-brand-border pt-4">
            <SecondaryButton onClick={() => setIsFormOpen(false)} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" isLoading={saving}>
              {editingDoctor ? 'Save Changes' : 'Create Doctor'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
