import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { getPatient, updatePatient } from '../services/api';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  dob: '',
  gender: 'Undisclosed',
  phone: '',
  email: '',
  address: '',
  emergencyContact: { name: '', relationship: '', phone: '' },
};

export default function ReceptionistPatientEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getPatient(id, { signal: controller.signal })
      .then((patient) => setFormData({
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        dob: patient.dob || '',
        gender: patient.gender || 'Undisclosed',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        emergencyContact: {
          name: patient.emergencyContact?.name || '',
          relationship: patient.emergencyContact?.relationship || '',
          phone: patient.emergencyContact?.phone || '',
        },
      }))
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, reloadKey]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await updatePatient(id, formData);
      navigate('/patients');
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageContainer title="Patient Demographics"><LoadingState message="Loading patient demographics..." /></PageContainer>;
  }

  if (loadError) {
    return (
      <PageContainer title="Unable to Load Patient">
        <ErrorState message={loadError} onRetry={() => setReloadKey((key) => key + 1)} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Edit Patient Demographics" subtitle={`Patient ${id}`}>
      <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-lg border border-brand-border bg-white p-6 shadow-card">
        {saveError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{saveError}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-brand-text">First name
            <input required maxLength={80} value={formData.firstName} onChange={(event) => setFormData({ ...formData, firstName: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-brand-text">Last name
            <input required maxLength={80} value={formData.lastName} onChange={(event) => setFormData({ ...formData, lastName: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-brand-text">Date of birth
            <input required type="date" value={formData.dob} onChange={(event) => setFormData({ ...formData, dob: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-brand-text">Gender
            <select value={formData.gender} onChange={(event) => setFormData({ ...formData, gender: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-normal">
              <option>Female</option><option>Male</option><option>Other</option><option>Undisclosed</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-brand-text">Phone
            <input required type="tel" maxLength={40} value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-brand-text">Email
            <input type="email" maxLength={254} value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-brand-text sm:col-span-2">Address
            <input maxLength={300} value={formData.address} onChange={(event) => setFormData({ ...formData, address: event.target.value })} className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal" />
          </label>
        </div>
        <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-brand-border p-4 sm:grid-cols-3">
          <legend className="px-1 text-xs font-semibold text-brand-text">Emergency contact</legend>
          {[
            ['name', 'Name'],
            ['relationship', 'Relationship'],
            ['phone', 'Phone'],
          ].map(([field, label]) => (
            <label key={field} className="text-xs font-semibold text-brand-text">{label}
              <input
                maxLength={field === 'relationship' ? 80 : 120}
                value={formData.emergencyContact[field]}
                onChange={(event) => setFormData({
                  ...formData,
                  emergencyContact: { ...formData.emergencyContact, [field]: event.target.value },
                })}
                className="mt-1 block w-full rounded-md border border-brand-border px-3 py-2 text-sm font-normal"
              />
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-brand-muted">Clinical notes, allergies, records, status, and doctor assignment are not editable from this role.</p>
        <div className="flex justify-end gap-2 border-t border-brand-border pt-4">
          <SecondaryButton onClick={() => navigate('/patients')} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" isLoading={saving}>Save Demographics</PrimaryButton>
        </div>
      </form>
    </PageContainer>
  );
}
