import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  HeartPulse,
  FileText,
  Clock,
  Edit2,
  ArrowLeft,
  AlertCircle,
  PlusCircle,
  Shield,
  Eye,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import {
  getPatient,
  listAppointments,
  listMedicalRecords,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManagePatients = ['admin', 'doctor', 'clinician', 'nurse'].includes(user?.role);
  const canCreateRecords = canManagePatients;
  const canScheduleAppointments = ['admin', 'doctor', 'clinician', 'nurse', 'records_staff'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'records' | 'appointments'
  const [selectedRecordForView, setSelectedRecordForView] = useState(null);
  const [patient, setPatient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadKey, setLoadKey] = useState(0);
  const [patientRecords, setPatientRecords] = useState([]);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [recordPagination, setRecordPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [appointmentPagination, setAppointmentPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [clinicalLoading, setClinicalLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState('');
  const [clinicalError, setClinicalError] = useState('');
  const [clinicalLoadKey, setClinicalLoadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    getPatient(id, { signal: controller.signal })
      .then(setPatient)
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setPatient(null);
          setLoadError(error.status === 404 ? '' : error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [id, loadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setClinicalLoading(true);
    setClinicalError('');
    Promise.all([
      listMedicalRecords({ patientId: id, page: '1', limit: '50' }, { signal: controller.signal }),
      listAppointments({ patientId: id, page: '1', limit: '50' }, { signal: controller.signal }),
    ])
      .then(([recordsResponse, appointmentsResponse]) => {
        setPatientRecords(recordsResponse.data);
        setPatientAppointments(appointmentsResponse.data.map((appointment) => ({
          ...appointment,
          statusVariant: appointment.status === 'Completed'
            ? 'success'
            : appointment.status === 'Cancelled'
              ? 'muted'
              : appointment.status === 'In Progress'
                ? 'warning'
                : 'neutral',
        })));
        setRecordPagination(recordsResponse.pagination);
        setAppointmentPagination(appointmentsResponse.pagination);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setClinicalError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setClinicalLoading(false);
      });
    return () => controller.abort();
  }, [id, clinicalLoadKey]);

  const loadMoreClinical = async (resource) => {
    if (loadingMore) return;
    const isRecords = resource === 'records';
    const pagination = isRecords ? recordPagination : appointmentPagination;
    setLoadingMore(resource);
    setClinicalError('');
    try {
      const response = isRecords
        ? await listMedicalRecords(
            { patientId: id, page: String(pagination.page + 1), limit: '50' }
          )
        : await listAppointments(
            { patientId: id, page: String(pagination.page + 1), limit: '50' }
          );
      if (isRecords) {
        setPatientRecords((records) => [...records, ...response.data]);
        setRecordPagination(response.pagination);
      } else {
        setPatientAppointments((appointments) => [
          ...appointments,
          ...response.data.map((appointment) => ({
            ...appointment,
            statusVariant: appointment.status === 'Completed'
              ? 'success'
              : appointment.status === 'Cancelled'
                ? 'muted'
                : appointment.status === 'In Progress'
                  ? 'warning'
                  : 'neutral',
          })),
        ]);
        setAppointmentPagination(response.pagination);
      }
    } catch (error) {
      setClinicalError(error.message);
    } finally {
      setLoadingMore('');
    }
  };

  if (isLoading) {
    return <PageContainer title="Loading Patient"><LoadingState message="Loading patient record..." /></PageContainer>;
  }

  if (loadError) {
    return (
      <PageContainer title="Unable to Load Patient">
        <ErrorState message={loadError} onRetry={() => setLoadKey((prev) => prev + 1)} />
      </PageContainer>
    );
  }

  // Gracefully handle invalid or unknown patient IDs
  if (!patient) {
    return (
      <PageContainer
        title="Patient Record Not Found"
        subtitle="The requested medical identifier does not match any registered patient."
      >
        <div className="bg-white rounded-lg border border-brand-border p-8 shadow-card">
          <EmptyState
            icon={AlertCircle}
            title="Unknown Patient Identifier"
            description={`No clinical record exists for patient ID "${id}". It may have been removed or the ID was entered incorrectly.`}
            action={
              <Link to="/patients">
                <SecondaryButton icon={ArrowLeft} size="sm">
                  Return to Patient Directory
                </SecondaryButton>
              </Link>
            }
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={patient.name}
      subtitle={`Medical Record Number: ${patient.id} • Registered ${patient.formattedRegDate || patient.registrationDate}`}
      actions={
        <div className="flex items-center gap-2">
          <Link to="/patients">
            <SecondaryButton icon={ArrowLeft} size="sm">
              Back
            </SecondaryButton>
          </Link>
          {canManagePatients && (
            <PrimaryButton
              icon={Edit2}
              size="sm"
              onClick={() => navigate(`/patients/${patient.id}/edit`)}
            >
              Edit Profile
            </PrimaryButton>
          )}
        </div>
      }
    >
      {/* Patient Header Summary Card */}
      <div className="bg-white rounded-lg border border-brand-border p-5 shadow-card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-full bg-teal-50 border border-teal-200 text-brand-primary flex items-center justify-center font-bold text-lg">
              {patient.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-brand-text">
                  {patient.name}
                </h1>
                <span className="font-mono text-xs font-semibold text-brand-primary bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {patient.id}
                </span>
                <StatusBadge variant={patient.statusVariant}>
                  {patient.status}
                </StatusBadge>
              </div>
              <p className="text-xs text-brand-muted mt-1 flex items-center gap-3 flex-wrap">
                <span>{patient.age} years old</span>
                <span>•</span>
                <span>{patient.gender}</span>
                <span>•</span>
                <span>DOB: {patient.dob}</span>
                <span>•</span>
                <span>Blood Group: {patient.bloodType || 'Unknown'}</span>
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 text-xs text-brand-muted">
            <span className="text-brand-text font-semibold">
              {patient.room || 'Outpatient Clinic'}
            </span>
            <span className="text-[11px]">
              Attending: {patient.doctorName || patient.primaryPhysician || 'Not assigned'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-brand-border mt-6 -mb-5 px-1 gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-brand-primary text-brand-primary font-bold'
                : 'border-transparent text-slate-500 hover:text-brand-text'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Profile & Demographics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'records'
                ? 'border-brand-primary text-brand-primary font-bold'
                : 'border-transparent text-slate-500 hover:text-brand-text'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Medical Records{!clinicalLoading ? ` (${patientRecords.length})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'appointments'
                ? 'border-brand-primary text-brand-primary font-bold'
                : 'border-transparent text-slate-500 hover:text-brand-text'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Appointments{!clinicalLoading ? ` (${patientAppointments.length})` : ''}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & DEMOGRAPHICS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Details Card */}
          <div className="bg-white rounded-lg border border-brand-border p-5 shadow-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-4 pb-2 border-b border-brand-border flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-brand-primary" />
              Contact Details
            </h3>

            <dl className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-brand-muted font-medium">Telephone:</dt>
                <dd className="text-brand-text font-semibold">{patient.phone || '—'}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-brand-muted font-medium">Email Address:</dt>
                <dd className="text-brand-text">{patient.email || 'None on file'}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-brand-muted font-medium">Physical Address:</dt>
                <dd className="text-brand-text text-right max-w-xs">{patient.address || '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Emergency Contact & Safety */}
          <div className="bg-white rounded-lg border border-brand-border p-5 shadow-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-4 pb-2 border-b border-brand-border flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-brand-primary" />
              Emergency Contact & Clinical Safety
            </h3>

            <dl className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-brand-muted font-medium">Contact Person:</dt>
                <dd className="text-brand-text font-semibold">
                  {patient.emergencyContact?.name || '—'} (
                  {patient.emergencyContact?.relationship || 'Emergency Contact'})
                </dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-brand-muted font-medium">Emergency Phone:</dt>
                <dd className="text-brand-text">{patient.emergencyContact?.phone || '—'}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-brand-muted font-medium">Known Allergies:</dt>
                <dd className="text-brand-error font-medium">{patient.allergies || 'None recorded'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* TAB 2: MEDICAL RECORDS */}
      {activeTab === 'records' && (
        <div className="bg-white rounded-lg border border-brand-border shadow-card p-5">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-brand-border">
            <div>
              <h3 className="text-sm font-bold text-brand-text">
                Clinical Consultations & EHR Encounters
              </h3>
              <p className="text-xs text-brand-muted">
                Documented diagnostic visits and physician notes
              </p>
            </div>
            {canCreateRecords && (
              <Link to="/medical-records/new" state={{ preselectedPatientId: patient.id }}>
                <PrimaryButton icon={PlusCircle} size="sm">
                  Add Medical Record
                </PrimaryButton>
              </Link>
            )}
          </div>

          {clinicalError ? (
            <ErrorState message={clinicalError} onRetry={() => setClinicalLoadKey((key) => key + 1)} />
          ) : clinicalLoading ? (
            <LoadingState message="Loading patient clinical records..." />
          ) : patientRecords.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Medical Records"
              description={`There are currently no clinical encounter records filed for ${patient.name}.`}
              action={canCreateRecords ? (
                <Link to="/medical-records/new" state={{ preselectedPatientId: patient.id }}>
                  <PrimaryButton size="sm" icon={PlusCircle}>
                    Create First Clinical Record
                  </PrimaryButton>
                </Link>
              ) : null}
            />
          ) : (
            <div className="space-y-3">
              {patientRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-4 rounded-lg border border-brand-border hover:border-slate-300 transition-colors bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-mono text-[11px] text-brand-primary bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {record.id}
                      </span>
                      <h4 className="text-sm font-bold text-brand-text mt-1">
                        {record.diagnosis}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-brand-muted">
                      <span>Visit Date: {record.formattedVisitDate || record.visitDate}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedRecordForView(record)}
                        className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Dossier</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed mb-2 line-clamp-2">
                    {record.clinicalNotes}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-brand-muted">
                    <span>Department: {record.department}</span>
                    <span>Physician: {record.attendingPhysician}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!clinicalError && !clinicalLoading && recordPagination.page < recordPagination.pages && (
            <div className="mt-4 text-center">
              <SecondaryButton
                size="sm"
                isLoading={loadingMore === 'records'}
                disabled={Boolean(loadingMore)}
                onClick={() => loadMoreClinical('records')}
              >
                Load More Records ({patientRecords.length} of {recordPagination.total})
              </SecondaryButton>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-lg border border-brand-border shadow-card p-5">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-brand-border">
            <div>
              <h3 className="text-sm font-bold text-brand-text">
                Appointment Schedule
              </h3>
              <p className="text-xs text-brand-muted">
                Hospital visits and specialist consultations
              </p>
            </div>
            <Link to="/appointments" state={{ scheduleForPatientId: patient.id }}>
              <PrimaryButton icon={Calendar} size="sm">
                Schedule Appointment
              </PrimaryButton>
            </Link>
          </div>

          {clinicalError ? (
            <ErrorState message={clinicalError} onRetry={() => setClinicalLoadKey((key) => key + 1)} />
          ) : clinicalLoading ? (
            <LoadingState message="Loading patient appointments..." />
          ) : patientAppointments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Appointments Scheduled"
              description={`There are no past or upcoming clinical appointments on file for ${patient.name}.`}
              action={canScheduleAppointments ? (
                <Link to="/appointments" state={{ scheduleForPatientId: patient.id }}>
                  <SecondaryButton size="sm">
                    Book an Appointment
                  </SecondaryButton>
                </Link>
              ) : null}
            />
          ) : (
            <div className="space-y-3">
              {patientAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 rounded-lg border border-brand-border hover:border-slate-300 transition-colors bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-brand-primary flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {apt.dateTime || `${apt.date} at ${apt.time}`}
                      </span>
                      <StatusBadge variant={apt.statusVariant}>
                        {apt.status}
                      </StatusBadge>
                    </div>
                    <p className="text-xs font-medium text-brand-text">{apt.reason}</p>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      Type: {apt.type} • Attending: {apt.assignedDoctor}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!clinicalError && !clinicalLoading && appointmentPagination.page < appointmentPagination.pages && (
            <div className="mt-4 text-center">
              <SecondaryButton
                size="sm"
                isLoading={loadingMore === 'appointments'}
                disabled={Boolean(loadingMore)}
                onClick={() => loadMoreClinical('appointments')}
              >
                Load More Appointments ({patientAppointments.length} of {appointmentPagination.total})
              </SecondaryButton>
            </div>
          )}
        </div>
      )}

      {/* Record View Dossier Modal */}
      {selectedRecordForView && (
        <Modal
          isOpen={Boolean(selectedRecordForView)}
          onClose={() => setSelectedRecordForView(null)}
          title={`Clinical Encounter: ${selectedRecordForView.id}`}
          subtitle={`Patient: ${selectedRecordForView.patientId}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-md border border-brand-border">
              <span className="text-brand-muted block font-medium mb-0.5">Diagnosis</span>
              <p className="text-sm font-bold text-brand-text">{selectedRecordForView.diagnosis}</p>
            </div>

            <div>
              <span className="text-brand-muted block font-semibold mb-1">Administered Treatment</span>
              <p className="text-slate-800 leading-relaxed bg-white p-2.5 rounded border border-brand-border">
                {selectedRecordForView.treatment}
              </p>
            </div>

            <div>
              <span className="text-brand-muted block font-semibold mb-1">Prescriptions & Regimens</span>
              <p className="text-slate-800 leading-relaxed bg-white p-2.5 rounded border border-brand-border font-mono text-[11px]">
                {selectedRecordForView.prescriptions}
              </p>
            </div>

            <div>
              <span className="text-brand-muted block font-semibold mb-1">Physician Clinical Progress Notes</span>
              <p className="text-slate-800 leading-relaxed bg-white p-2.5 rounded border border-brand-border">
                {selectedRecordForView.clinicalNotes}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-brand-border text-brand-muted">
              <div>
                <span className="block font-medium">Attending Physician:</span>
                <span className="text-brand-text font-semibold">{selectedRecordForView.attendingPhysician}</span>
              </div>
              <div>
                <span className="block font-medium">Department:</span>
                <span className="text-brand-text font-semibold">{selectedRecordForView.department}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
