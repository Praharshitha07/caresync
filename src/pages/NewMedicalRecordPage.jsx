import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  FileText,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Pill,
  Stethoscope,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { createMedicalRecord, listPatients } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function NewMedicalRecordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canCreate = ['admin', 'clinician', 'nurse'].includes(user?.role);
  const [patients, setPatients] = useState([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [patientLoadError, setPatientLoadError] = useState('');
  const [loadKey, setLoadKey] = useState(0);

  const preselectedPatientId = location.state?.preselectedPatientId || '';

  const [formData, setFormData] = useState({
    patientId: preselectedPatientId,
    visitDate: new Date().toISOString().split('T')[0],
    diagnosis: '',
    treatment: '',
    prescriptions: '',
    clinicalNotes: '',
    attendingPhysician: 'Dr. Sarah Jenkins',
    department: 'General Medicine',
    followUpDate: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingPatients(true);
    setPatientLoadError('');
    listPatients({ page: '1', limit: '50', sort: 'registrationDate', order: 'desc' }, {
      signal: controller.signal,
    })
      .then((response) => {
        setPatients(response.data);
        setFormData((previous) => ({
          ...previous,
          patientId: (
            response.data.some((patient) => patient.id === preselectedPatientId)
              ? preselectedPatientId
              : previous.patientId && response.data.some((patient) => patient.id === previous.patientId)
                ? previous.patientId
                : response.data[0]?.id || ''
          ),
        }));
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setPatientLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingPatients(false);
      });
    return () => controller.abort();
  }, [loadKey, preselectedPatientId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.patientId) {
      newErrors.patientId = 'Please select a patient.';
    }
    if (!formData.visitDate) {
      newErrors.visitDate = 'Visit date is required.';
    }
    if (!formData.diagnosis.trim()) {
      newErrors.diagnosis = 'Primary diagnosis is required.';
    }
    if (!formData.treatment.trim()) {
      newErrors.treatment = 'Treatment or intervention details are required.';
    }
    if (!formData.clinicalNotes.trim()) {
      newErrors.clinicalNotes = 'Physician progress notes are required.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate || !validate() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const created = await createMedicalRecord({
        ...formData,
        followUpDate: formData.followUpDate || '',
      });
      setSuccessFeedback(`Medical record ${created.id} filed successfully.`);
      setTimeout(() => navigate('/medical-records'), 600);
    } catch (error) {
      const fieldErrors = Object.fromEntries(
        (error.errors || []).map(({ field, message }) => [field, message])
      );
      if (Object.keys(fieldErrors).length) setErrors((previous) => ({ ...previous, ...fieldErrors }));
      setSubmitError(error.status === 403
        ? 'Your account does not have permission to create medical records.'
        : error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <PageContainer title="Access Restricted">
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Your account has read-only access to medical records. Contact an administrator if this access is incorrect.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Add Medical Record"
      subtitle="Document a clinical encounter, diagnostic review, or treatment regimen."
      actions={
        <Link to="/medical-records">
          <SecondaryButton icon={ArrowLeft} size="sm">
            Cancel
          </SecondaryButton>
        </Link>
      }
    >
      {patientLoadError ? (
        <div className="mb-6">
          <ErrorState message={patientLoadError} onRetry={() => setLoadKey((key) => key + 1)} />
        </div>
      ) : isLoadingPatients ? (
        <LoadingState message="Loading active patients..." />
      ) : patients.length === 0 ? (
        <div role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Add an active patient before creating a medical record.
        </div>
      ) : null}

      {submitError && (
        <div role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {submitError}
        </div>
      )}

      {successFeedback && (
        <div
          role="status"
          className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-xs text-emerald-800 animate-in fade-in"
        >
          <CheckCircle2 className="h-5 w-5 text-brand-success flex-shrink-0" />
          <span className="font-medium">{successFeedback}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Patient & Encounter Details */}
        <div className="bg-white rounded-lg border border-brand-border p-6 shadow-card">
          <div className="flex items-center gap-2 pb-3 mb-5 border-b border-brand-border">
            <User className="h-4 w-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-brand-text uppercase tracking-wide">
              Patient & Encounter Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Patient Selector */}
            <div>
              <label
                htmlFor="patientId"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Select Patient <span className="text-brand-error">*</span>
              </label>
              <select
                id="patientId"
                name="patientId"
                value={formData.patientId}
                onChange={handleChange}
                disabled={isSubmitting || isLoadingPatients || patients.length === 0}
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text bg-white focus:outline-none focus:ring-1 transition-colors ${
                  errors.patientId
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id}) — {p.gender}, {p.age}y
                  </option>
                ))}
              </select>
              {errors.patientId && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.patientId}
                </p>
              )}
            </div>

            {/* Visit Date */}
            <div>
              <label
                htmlFor="visitDate"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Visit Encounter Date <span className="text-brand-error">*</span>
              </label>
              <input
                id="visitDate"
                name="visitDate"
                type="date"
                value={formData.visitDate}
                onChange={handleChange}
                disabled={isSubmitting || isLoadingPatients || patients.length === 0}
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text focus:outline-none focus:ring-1 transition-colors ${
                  errors.visitDate
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              />
              {errors.visitDate && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.visitDate}
                </p>
              )}
            </div>

            {/* Department */}
            <div>
              <label
                htmlFor="department"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Department / Clinical Unit
              </label>
              <select
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                disabled={isSubmitting}
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="General Medicine">General Medicine</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Pulmonology">Pulmonology & Critical Care</option>
                <option value="Endocrinology">Endocrinology</option>
                <option value="Emergency Care">Emergency Care</option>
              </select>
            </div>
          </div>
        </div>

        {/* Diagnosis & Clinical Documentation */}
        <div className="bg-white rounded-lg border border-brand-border p-6 shadow-card">
          <div className="flex items-center gap-2 pb-3 mb-5 border-b border-brand-border">
            <Stethoscope className="h-4 w-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-brand-text uppercase tracking-wide">
              Clinical Assessment & Treatment
            </h2>
          </div>

          <div className="space-y-4">
            {/* Diagnosis */}
            <div>
              <label
                htmlFor="diagnosis"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Primary Diagnosis / Chief Complaint <span className="text-brand-error">*</span>
              </label>
              <input
                id="diagnosis"
                name="diagnosis"
                type="text"
                value={formData.diagnosis}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="e.g. Acute Bronchitis with mild expiratory wheezing"
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${
                  errors.diagnosis
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              />
              {errors.diagnosis && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.diagnosis}
                </p>
              )}
            </div>

            {/* Treatment */}
            <div>
              <label
                htmlFor="treatment"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Treatment Administered / Interventions <span className="text-brand-error">*</span>
              </label>
              <textarea
                id="treatment"
                name="treatment"
                rows={2}
                value={formData.treatment}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="e.g. Nebulized bronchodilator treatment administered, vitals monitored q1h."
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${
                  errors.treatment
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              />
              {errors.treatment && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.treatment}
                </p>
              )}
            </div>

            {/* Prescriptions */}
            <div>
              <label
                htmlFor="prescriptions"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Prescriptions & Medication Regimens <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="prescriptions"
                name="prescriptions"
                type="text"
                value={formData.prescriptions}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="e.g. Albuterol MDI 2 puffs q4-6h PRN, Amoxicillin 500mg PO TID x 10 days"
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Clinical Notes */}
            <div>
              <label
                htmlFor="clinicalNotes"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Physician Progress Notes <span className="text-brand-error">*</span>
              </label>
              <textarea
                id="clinicalNotes"
                name="clinicalNotes"
                rows={3}
                value={formData.clinicalNotes}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="Document detailed findings, physical exam observations, and clinical rationale..."
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${
                  errors.clinicalNotes
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              />
              {errors.clinicalNotes && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.clinicalNotes}
                </p>
              )}
            </div>

            {/* Follow-up Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label
                  htmlFor="followUpDate"
                  className="block text-xs font-semibold text-brand-text mb-1"
                >
                  Recommended Follow-up Date <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="followUpDate"
                  name="followUpDate"
                  type="date"
                  value={formData.followUpDate}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="attendingPhysician"
                  className="block text-xs font-semibold text-brand-text mb-1"
                >
                  Attending Physician
                </label>
                <select
                  id="attendingPhysician"
                  name="attendingPhysician"
                  value={formData.attendingPhysician}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
                >
                  <option value="Dr. Sarah Jenkins">Dr. Sarah Jenkins (Internal Medicine)</option>
                  <option value="Dr. Robert Chen">Dr. Robert Chen (Orthopedic Surgery)</option>
                  <option value="Dr. Maya Patel">Dr. Maya Patel (Cardiology)</option>
                  <option value="Dr. Gregory House">Dr. Gregory House (Diagnostics)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
          <Link to="/medical-records">
            <SecondaryButton disabled={isSubmitting}>
              Cancel
            </SecondaryButton>
          </Link>
          <PrimaryButton
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            File Medical Record
          </PrimaryButton>
        </div>
      </form>
    </PageContainer>
  );
}
