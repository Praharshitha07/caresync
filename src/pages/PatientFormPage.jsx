import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Shield,
  HeartPulse,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Info,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import {
  ApiError,
  createPatient,
  getPatient,
  listDoctors,
  updatePatient,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

function toApiPatient(formData, role) {
  if (role === 'receptionist') {
    return {
      firstName: formData.firstName,
      lastName: formData.lastName,
      dob: formData.dob,
      gender: formData.gender,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      emergencyContact: {
        name: formData.emergencyContactName,
        relationship: formData.emergencyContactRelation,
        phone: formData.emergencyContactPhone,
      },
      doctorId: formData.doctorId,
    };
  }
  return {
    firstName: formData.firstName,
    lastName: formData.lastName,
    dob: formData.dob,
    gender: formData.gender,
    phone: formData.phone,
    email: formData.email,
    address: formData.address,
    emergencyContact: {
      name: formData.emergencyContactName,
      relationship: formData.emergencyContactRelation,
      phone: formData.emergencyContactPhone,
    },
    status: formData.status,
    primaryPhysician: formData.primaryPhysician,
    ...(formData.doctorId ? { doctorId: formData.doctorId } : {}),
    room: formData.room,
    bloodType: formData.bloodType,
    allergies: formData.allergies,
  };
}
export default function PatientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManagePatients = ['admin', 'doctor', 'clinician', 'nurse'].includes(user?.role)
    || (user?.role === 'receptionist' && !id);
  const isEditMode = Boolean(id);
  const [existingPatient, setExistingPatient] = useState(null);
  const [isLoadingPatient, setIsLoadingPatient] = useState(isEditMode);
  const [loadError, setLoadError] = useState('');
  const [loadKey, setLoadKey] = useState(0);
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState('');
  const [doctorsReloadKey, setDoctorsReloadKey] = useState(0);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    gender: 'Female',
    phone: '',
    email: '',
    address: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    doctorId: '',
    room: 'Ambulatory Care Unit',
    bloodType: 'O+',
    allergies: '',
    status: 'Outpatient',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState(null);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setDoctorsLoading(true);
    setDoctorsError('');
    listDoctors({}, { signal: controller.signal })
      .then((activeDoctors) => {
        const availableDoctors = user?.role === 'doctor'
          ? activeDoctors.filter((doctor) => doctor.id === user.doctorId)
          : activeDoctors;
        setDoctors(availableDoctors);
        if (user?.role === 'doctor' && availableDoctors[0]) {
          setFormData((previous) => ({ ...previous, doctorId: availableDoctors[0].id }));
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setDoctorsError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDoctorsLoading(false);
      });
    return () => controller.abort();
  }, [doctorsReloadKey, user?.doctorId, user?.role]);

  useEffect(() => {
    if (!isEditMode) {
      setIsLoadingPatient(false);
      return undefined;
    }

    const controller = new AbortController();
    setIsLoadingPatient(true);
    setLoadError('');
    getPatient(id, { signal: controller.signal })
      .then((patient) => setExistingPatient(patient))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoadError(error.status === 404 ? '' : error.message);
          setExistingPatient(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingPatient(false);
      });

    return () => controller.abort();
  }, [id, isEditMode, loadKey]);

  useEffect(() => {
    if (!existingPatient) return;
    setFormData({
      firstName: existingPatient.firstName || '',
      lastName: existingPatient.lastName || '',
      dob: existingPatient.dob || '',
      gender: existingPatient.gender || 'Undisclosed',
      phone: existingPatient.phone || '',
      email: existingPatient.email || '',
      address: existingPatient.address || '',
      emergencyContactName: existingPatient.emergencyContact?.name || '',
      emergencyContactRelation: existingPatient.emergencyContact?.relationship || '',
      emergencyContactPhone: existingPatient.emergencyContact?.phone || '',
      doctorId: existingPatient.doctorId || '',
      room: existingPatient.room || '',
      bloodType: existingPatient.bloodType || 'Unknown',
      allergies: existingPatient.allergies || '',
      status: existingPatient.status || 'Outpatient',
    });
  }, [existingPatient]);

  if (isLoadingPatient) {
    return <PageContainer title="Loading Patient"><LoadingState message="Loading patient profile..." /></PageContainer>;
  }

  if (!canManagePatients) {
    return (
      <PageContainer title="Access Restricted">
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Your account has read-only access to patient records. Contact an administrator if this access is incorrect.
        </div>
      </PageContainer>
    );
  }

  if (isEditMode && loadError) {
    return (
      <PageContainer title="Unable to Load Patient">
        <ErrorState message={loadError} onRetry={() => setLoadKey((prev) => prev + 1)} />
      </PageContainer>
    );
  }

  if (isEditMode && !existingPatient) {
    return (
      <PageContainer
        title="Patient Not Found"
        subtitle="The requested patient ID does not exist in the hospital directory."
      >
        <EmptyState
          icon={AlertCircle}
          title="Unknown Patient Identifier"
          description={`No patient record matching ID "${id}" was found.`}
          action={
            <Link to="/patients">
              <SecondaryButton icon={ArrowLeft} size="sm">
                Return to Patients Directory
              </SecondaryButton>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setServerError('');
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Comprehensive Form Validation
  const validateForm = () => {
    const newErrors = {};
    const today = new Date().toISOString().split('T')[0];

    // Personal Info
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required.';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required.';
    }
    if (!formData.dob) {
      newErrors.dob = 'Date of birth is required.';
    } else {
      const birthYear = new Date(formData.dob).getFullYear();
      if (formData.dob > today) {
        newErrors.dob = 'Date of birth cannot be in the future.';
      } else if (birthYear < 1900) {
        newErrors.dob = 'Please enter a valid birth year (1900 or later).';
      }
    }

    // Contact Info
    if (!formData.phone.trim()) {
      newErrors.phone = 'Contact phone number is required.';
    } else if (formData.phone.trim().length < 7) {
      newErrors.phone = 'Please provide a valid telephone number.';
    }
    if (!isEditMode && !formData.doctorId) {
      newErrors.doctorId = doctors.length
        ? 'Select an attending doctor.'
        : 'An active doctor must be available before registering a patient.';
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please provide a valid email format (e.g., patient@example.com).';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    setServerError('');
    try {
      const payload = toApiPatient(formData, user?.role);
      const savedPatient = isEditMode
        ? await updatePatient(id, payload)
        : await createPatient(payload);
      setSubmissionFeedback({
        type: 'success',
        message: isEditMode
          ? `Patient ${savedPatient.name} (${savedPatient.id}) updated successfully.`
          : `New patient record ${savedPatient.id} (${savedPatient.name}) registered successfully.`,
      });
      window.setTimeout(
        () => navigate(user?.role === 'receptionist' ? '/patients' : `/patients/${savedPatient.id}`),
        700
      );
    } catch (error) {
      if (error instanceof ApiError && error.errors.length) {
        const fieldMap = {
          'emergencyContact.name': 'emergencyContactName',
          'emergencyContact.relationship': 'emergencyContactRelation',
          'emergencyContact.phone': 'emergencyContactPhone',
        };
        setErrors((previous) => ({
          ...previous,
          ...Object.fromEntries(
            error.errors.map(({ field, message }) => [fieldMap[field] || field, message])
          ),
        }));
        setServerError('Review the highlighted fields and try again.');
      } else {
        setServerError(error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer
      title={isEditMode ? `Edit Patient Profile: ${existingPatient.name}` : 'Register New Patient'}
      subtitle={
        isEditMode
          ? `Update demographic, contact, and emergency information for record ID ${id}.`
          : 'Complete the intake dossier for outpatient or inpatient hospital registration.'
      }
      actions={
        <Link to={isEditMode ? `/patients/${id}` : '/patients'}>
          <SecondaryButton icon={ArrowLeft} size="sm">
            Cancel & Return
          </SecondaryButton>
        </Link>
      }
    >
      {/* Access Boundary Notice */}
      <div className="mb-6 p-3 bg-white border border-brand-border rounded-lg shadow-card flex items-start gap-2.5 text-xs text-brand-muted">
        <Info className="h-4 w-4 text-brand-primary flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-brand-text font-semibold">Protected patient data:</strong>{' '}
          Changes are submitted to the authenticated CareSync API and remain subject to server-side role authorization.
        </div>
      </div>

      {serverError && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {serverError}
        </div>
      )}

      {doctorsError ? (
        <ErrorState
          title="Unable to Load Doctors"
          message={doctorsError}
          onRetry={() => setDoctorsReloadKey((key) => key + 1)}
          className="mb-4"
        />
      ) : null}

      {/* Success Notification */}
      {submissionFeedback && (
        <div
          role="status"
          className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-xs text-emerald-800 animate-in fade-in"
        >
          <CheckCircle2 className="h-5 w-5 text-brand-success flex-shrink-0" />
          <span className="font-medium">{submissionFeedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* SECTION A: Personal Information */}
        <div className="bg-white rounded-lg border border-brand-border p-6 shadow-card">
          <div className="flex items-center gap-2 pb-3 mb-5 border-b border-brand-border">
            <User className="h-4 w-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-brand-text uppercase tracking-wide">
              Section A: Personal Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* First Name */}
            <div>
              <label
                htmlFor="firstName"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                First Name <span className="text-brand-error">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="e.g. Eleanor"
                aria-invalid={errors.firstName ? 'true' : 'false'}
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${
                  errors.firstName
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.firstName}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label
                htmlFor="lastName"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Last Name <span className="text-brand-error">*</span>
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="e.g. Vance"
                aria-invalid={errors.lastName ? 'true' : 'false'}
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${
                  errors.lastName
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.lastName}
                </p>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label
                htmlFor="dob"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Date of Birth <span className="text-brand-error">*</span>
              </label>
              <input
                id="dob"
                name="dob"
                type="date"
                value={formData.dob}
                onChange={handleChange}
                disabled={isSubmitting}
                aria-invalid={errors.dob ? 'true' : 'false'}
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text focus:outline-none focus:ring-1 transition-colors ${
                  errors.dob
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              />
              {errors.dob && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.dob}
                </p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label
                htmlFor="gender"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Biological Gender
              </label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                disabled={isSubmitting}
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other / Non-Binary</option>
                <option value="Undisclosed">Prefer not to disclose</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION B: Contact Information */}
        <div className="bg-white rounded-lg border border-brand-border p-6 shadow-card">
          <div className="flex items-center gap-2 pb-3 mb-5 border-b border-brand-border">
            <Phone className="h-4 w-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-brand-text uppercase tracking-wide">
              Section B: Contact Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Phone Number <span className="text-brand-error">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="+1 (555) 000-0000"
                aria-invalid={errors.phone ? 'true' : 'false'}
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${
                  errors.phone
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Email (Optional) */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Email Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="patient@example.org"
                aria-invalid={errors.email ? 'true' : 'false'}
                className={`block w-full py-2 px-3 text-sm rounded-md border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${
                  errors.email
                    ? 'border-red-400 focus:ring-brand-error'
                    : 'border-brand-border focus:ring-brand-primary focus:border-brand-primary'
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-brand-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label
                htmlFor="address"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Residential Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                value={formData.address}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="e.g. 742 Evergreen Terrace, City, State"
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>
        </div>

        {/* SECTION C: Optional Administrative & Clinical Information */}
        <div className="bg-white rounded-lg border border-brand-border p-6 shadow-card">
          <div className="flex items-center gap-2 pb-3 mb-5 border-b border-brand-border">
            <HeartPulse className="h-4 w-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-brand-text uppercase tracking-wide">
              Section C: Administrative & Clinical Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Emergency Contact Name */}
            <div>
              <label
                htmlFor="emergencyContactName"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Emergency Contact Name
              </label>
              <input
                id="emergencyContactName"
                name="emergencyContactName"
                type="text"
                value={formData.emergencyContactName}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="e.g. Thomas Vance"
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Emergency Contact Relation */}
            <div>
              <label
                htmlFor="emergencyContactRelation"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Relationship to Patient
              </label>
              <input
                id="emergencyContactRelation"
                name="emergencyContactRelation"
                type="text"
                value={formData.emergencyContactRelation}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="e.g. Spouse, Parent, Sibling"
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Emergency Contact Phone */}
            <div>
              <label
                htmlFor="emergencyContactPhone"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Emergency Contact Phone
              </label>
              <input
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="+1 (555) 000-0000"
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
            {/* Status */}
            {user?.role !== 'receptionist' && (
            <div>
              <label
                htmlFor="status"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Admission Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                disabled={isSubmitting}
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="Outpatient">Outpatient</option>
                <option value="Admitted">Admitted</option>
                <option value="Observation">Observation</option>
                <option value="Discharged">Discharged</option>
              </select>
            </div>
            )}

            {/* Attending Doctor */}
            <div>
              <label
                htmlFor="doctorId"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Attending Doctor <span className="text-brand-error">*</span>
              </label>
              <select
                id="doctorId"
                name="doctorId"
                value={formData.doctorId}
                onChange={handleChange}
                disabled={isSubmitting || doctorsLoading || Boolean(doctorsError)}
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">Select an active doctor</option>
                {isEditMode
                  && formData.doctorId
                  && !doctors.some((doctor) => doctor.id === formData.doctorId) && (
                    <option value={formData.doctorId} disabled>
                      Current historical assignment: {existingPatient?.doctorName
                        || existingPatient?.primaryPhysician
                        || 'Doctor profile unavailable'}
                    </option>
                )}
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} ({doctor.specialty})
                  </option>
                ))}
              </select>
              {doctorsLoading ? (
                <p className="mt-1 text-xs text-brand-muted">Loading active doctors...</p>
              ) : doctors.length === 0 && !doctorsError ? (
                <p className="mt-1 text-xs text-amber-700">
                  No active doctors are available. Ask an administrator to add doctors before registering a patient.
                </p>
              ) : null}
              {errors.doctorId && (
                <p className="mt-1 text-xs text-brand-error">{errors.doctorId}</p>
              )}
            </div>

            {/* Blood Type */}
            {user?.role !== 'receptionist' && (
            <>
            <div>
              <label
                htmlFor="bloodType"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Blood Group
              </label>
              <select
                id="bloodType"
                name="bloodType"
                value={formData.bloodType}
                onChange={handleChange}
                disabled={isSubmitting}
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            {/* Allergies */}
            <div>
              <label
                htmlFor="allergies"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Known Allergies
              </label>
              <input
                id="allergies"
                name="allergies"
                type="text"
                value={formData.allergies}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="e.g. Penicillin, Latex"
                className="block w-full py-2 px-3 text-sm rounded-md border border-brand-border text-brand-text placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
          <Link to={isEditMode ? `/patients/${id}` : '/patients'}>
            <SecondaryButton disabled={isSubmitting}>
              Cancel
            </SecondaryButton>
          </Link>
          <PrimaryButton
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {isEditMode ? 'Update Patient Dossier' : 'Save Patient Registration'}
          </PrimaryButton>
        </div>
      </form>
    </PageContainer>
  );
}
