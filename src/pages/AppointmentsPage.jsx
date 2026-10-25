import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Calendar,
  Clock,
  RotateCcw,
  Ban,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  UserRoundPen,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import StatCard from '../components/StatCard';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import SearchInput from '../components/SearchInput';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { useAuth } from '../context/AuthContext';
import {
  archiveAppointment,
  createAppointment,
  listAppointments,
  listDoctors,
  listPatients,
  updateAppointment,
} from '../services/api';

export default function AppointmentsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const canUpdate = ['admin', 'doctor', 'clinician', 'nurse'].includes(user?.role);
  const canArchive = user?.role === 'admin';
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorLoadError, setDoctorLoadError] = useState('');
  const [doctorsLoadKey, setDoctorsLoadKey] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [patientLoadError, setPatientLoadError] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [actionError, setActionError] = useState('');

  // Search, filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    patientId: location.state?.scheduleForPatientId || '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    reason: '',
    type: 'Clinical Consultation',
    assignedDoctor: '',
    doctorId: '',
    room: 'Consultation Suite 1',
  });
  const [scheduleErrors, setScheduleErrors] = useState({});
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  // Cancel confirmation state
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [appointmentForDoctorChange, setAppointmentForDoctorChange] = useState(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isSavingDoctor, setIsSavingDoctor] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setDoctorsLoading(true);
    setDoctorLoadError('');
    listDoctors({}, { signal: controller.signal })
      .then((activeDoctors) => {
        const availableDoctors = user?.role === 'doctor'
          ? activeDoctors.filter((doctor) => doctor.id === user.doctorId)
          : activeDoctors;
        setDoctors(availableDoctors);
        setScheduleData((previous) => ({
          ...previous,
          assignedDoctor: previous.assignedDoctor || availableDoctors[0]?.name || '',
          doctorId: previous.doctorId || availableDoctors[0]?.id || '',
        }));
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setDoctorLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDoctorsLoading(false);
      });
    return () => controller.abort();
  }, [doctorsLoadKey, user?.doctorId, user?.role]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    const params = { page: String(currentPage), limit: '50' };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    const timer = window.setTimeout(() => {
      listAppointments(params, { signal: controller.signal })
        .then((response) => {
          setAppointments(response.data.map((appointment) => ({
            ...appointment,
            statusVariant: appointment.status === 'Completed'
              ? 'success'
              : appointment.status === 'Cancelled'
                ? 'muted'
                : appointment.status === 'In Progress'
                  ? 'warning'
                  : 'neutral',
          })));
          setPagination(response.pagination);
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setLoadError(error.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentPage, loadKey, searchQuery, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingPatients(true);
    setPatientLoadError('');
    const params = { page: '1', limit: '50', sort: 'registrationDate', order: 'desc' };
    if (patientSearch.trim()) params.search = patientSearch.trim();
    listPatients(params, {
      signal: controller.signal,
    })
      .then((response) => {
        setPatients(response.data);
        setScheduleData((previous) => ({
          ...previous,
          patientId: previous.patientId || location.state?.scheduleForPatientId || response.data[0]?.id || '',
        }));
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setPatientLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingPatients(false);
      });
    return () => controller.abort();
  }, [loadKey, location.state?.scheduleForPatientId, patientSearch]);

  const appointmentsWithPatients = useMemo(
    () => appointments.map((appointment) => ({
      ...appointment,
      patientName: appointment.patientName || `Patient ${appointment.patientId}`,
    })),
    [appointments]
  );

  // Summary counts
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = appointmentsWithPatients.filter((a) => a.date === todayStr).length;
  const upcomingCount = appointmentsWithPatients.filter(
    (a) => a.status === 'Scheduled' || a.status === 'Confirmed'
  ).length;

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointmentsWithPatients;
  }, [appointmentsWithPatients]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  // Schedule Appointment Submission
  const validateSchedule = () => {
    const errs = {};
    if (!scheduleData.patientId) errs.patientId = 'Please select a patient.';
    if (!scheduleData.date) errs.date = 'Appointment date is required.';
    if (!scheduleData.time) errs.time = 'Appointment time is required.';
    if (!scheduleData.reason.trim()) errs.reason = 'Reason or clinical consult type is required.';
    if (!scheduleData.doctorId) errs.assignedDoctor = 'Select an active doctor.';
    setScheduleErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!validateSchedule() || isSubmittingSchedule) return;

    setIsSubmittingSchedule(true);
    setActionError('');
    try {
      const newApt = await createAppointment(scheduleData);
      setIsScheduleModalOpen(false);
      setScheduleData((previous) => ({
        ...previous,
        patientId: patients[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00 AM',
        reason: '',
      }));
      setFeedbackMessage(`Appointment ${newApt.id} scheduled for ${newApt.date}.`);
      setLoadKey((key) => key + 1);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (error) {
      const fieldErrors = Object.fromEntries(
        (error.errors || []).map(({ field, message }) => [field, message])
      );
      if (Object.keys(fieldErrors).length) setScheduleErrors((previous) => ({ ...previous, ...fieldErrors }));
      setActionError(error.status === 403
        ? 'Your account does not have permission to schedule appointments.'
        : error.message);
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;
    setIsCancelling(true);
    setActionError('');
    try {
      await archiveAppointment(appointmentToCancel.id);
      setFeedbackMessage(`Appointment ${appointmentToCancel.id} cancelled.`);
      setAppointmentToCancel(null);
      setLoadKey((key) => key + 1);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (error) {
      setActionError(error.status === 403
        ? 'Only administrators can cancel appointments.'
        : error.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const changeStatus = async (appointment, status) => {
    setActionError('');
    try {
      await updateAppointment(appointment.id, { status });
      setFeedbackMessage(`Appointment ${appointment.id} updated to ${status}.`);
      setLoadKey((key) => key + 1);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (error) {
      setActionError(error.status === 403
        ? 'Your account does not have permission to update appointment status.'
        : error.message);
    }
  };

  const handleDoctorChange = async (event) => {
    event.preventDefault();
    if (!appointmentForDoctorChange || isSavingDoctor) return;
    const doctor = doctors.find(({ id }) => id === selectedDoctorId);
    if (!doctor) {
      setActionError('Select an active doctor before updating the appointment.');
      return;
    }

    setActionError('');
    setIsSavingDoctor(true);
    try {
      await updateAppointment(appointmentForDoctorChange.id, {
        doctorId: doctor.id,
        assignedDoctor: doctor.name,
      });
      setAppointmentForDoctorChange(null);
      setFeedbackMessage(`Assigned doctor updated for appointment ${appointmentForDoctorChange.id}.`);
      setLoadKey((key) => key + 1);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (error) {
      setActionError(error.status === 403
        ? 'Your account does not have permission to update this appointment.'
        : error.message);
    } finally {
      setIsSavingDoctor(false);
    }
  };

  return (
    <PageContainer
      title="Appointments Schedule"
      subtitle="Physician consult calendars, outpatient follow-ups, and clinical booking dispatch."
      actions={
        <PrimaryButton
          icon={CalendarPlus}
          onClick={() => setIsScheduleModalOpen(true)}
        >
          Schedule Appointment
        </PrimaryButton>
      }
    >
      {/* Feedback banner */}
      {feedbackMessage && (
        <div
          role="status"
          className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs flex items-center justify-between animate-in fade-in"
        >
          <span>{feedbackMessage}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}
      {actionError && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {actionError}
        </div>
      )}
      {patientLoadError && (
        <div role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Patient names could not be loaded. Appointments remain available by patient ID. {patientLoadError}
          <button
            type="button"
            onClick={() => setLoadKey((key) => key + 1)}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard
          title="Today's Appointments"
          value={todayCount.toString()}
          helperText="Today's appointments on the current page"
          icon={Calendar}
        />
        <StatCard
          title="Upcoming Appointments"
          value={upcomingCount.toString()}
          helperText="Upcoming appointments on the current page"
          icon={Clock}
        />
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border border-brand-border p-4 shadow-card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-8">
            <SearchInput
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              onClear={() => setSearchQuery('')}
              placeholder="Search by patient ID, doctor, or consult reason..."
              ariaLabel="Search appointments"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-1.5">
            <label htmlFor="apt-status-filter" className="text-xs font-semibold text-brand-muted whitespace-nowrap">
              Status:
            </label>
            <select
              id="apt-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="all">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Confirmed">Confirmed</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="md:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="p-2 text-xs text-brand-muted hover:text-brand-text hover:bg-slate-100 rounded-md transition-colors border border-brand-border"
              aria-label="Clear appointment filters"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Appointment Table */}
      <div className="bg-white rounded-lg border border-brand-border shadow-card overflow-hidden">
        {loadError ? (
          <div className="p-6">
            <ErrorState message={loadError} onRetry={() => setLoadKey((key) => key + 1)} />
          </div>
        ) : isLoading ? (
          <LoadingState message="Loading appointments..." />
        ) : filteredAppointments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Appointments Found"
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'No clinical appointments matched your filter criteria.'
                  : 'There are currently no appointments scheduled in the hospital system.'
              }
              icon={Calendar}
              action={
                searchQuery || statusFilter !== 'all' ? (
                  <SecondaryButton size="sm" onClick={handleResetFilters}>
                    Clear Filters
                  </SecondaryButton>
                ) : (
                  <PrimaryButton
                    size="sm"
                    icon={CalendarPlus}
                    onClick={() => setIsScheduleModalOpen(true)}
                  >
                    Schedule First Appointment
                  </PrimaryButton>
                )
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-border text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-brand-muted uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Patient</th>
                  <th scope="col" className="px-4 py-3">Date & Time</th>
                  <th scope="col" className="px-4 py-3">Reason / Clinical Type</th>
                  <th scope="col" className="px-4 py-3">Assigned Doctor</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border bg-white">
                {filteredAppointments.map((apt) => (
                  <tr
                    key={apt.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Patient */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-semibold text-brand-text block">
                        {apt.patientName}
                      </span>
                      <span className="font-mono text-[11px] text-brand-muted">
                        {apt.patientId}
                      </span>
                    </td>

                    {/* Date & Time */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                      <div className="font-medium text-brand-text">
                        {apt.formattedDate || apt.date}
                      </div>
                      <div className="text-brand-muted flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-brand-primary" />
                        <span>{apt.time}</span>
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="px-4 py-3.5 text-xs text-brand-text max-w-xs">
                      <span className="font-medium block truncate">{apt.reason}</span>
                      <span className="text-[11px] text-brand-muted">{apt.type} • {apt.room}</span>
                    </td>

                    {/* Doctor */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-700 font-medium">
                      {apt.assignedDoctor}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge variant={apt.statusVariant}>
                        {apt.status}
                      </StatusBadge>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Status Toggle */}
                        {canUpdate && apt.status === 'Scheduled' && (
                          <button
                            type="button"
                            onClick={() => changeStatus(apt, 'Confirmed')}
                            className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                            title="Confirm Appointment"
                          >
                            Confirm
                          </button>
                        )}
                        {canUpdate && apt.status === 'Confirmed' && (
                          <button
                            type="button"
                            onClick={() => changeStatus(apt, 'Completed')}
                            className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            title="Mark as Completed"
                          >
                            Complete
                          </button>
                        )}
                        {canUpdate && ['Scheduled', 'Confirmed'].includes(apt.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAppointmentForDoctorChange(apt);
                              setSelectedDoctorId(
                                doctors.some(({ id }) => id === apt.doctorId) ? apt.doctorId : ''
                              );
                              setActionError('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-primary bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition-colors"
                            aria-label={`Change doctor for appointment with ${apt.patientName}`}
                          >
                            <UserRoundPen className="h-3 w-3" aria-hidden="true" />
                            Change Doctor
                          </button>
                        )}
                        {canArchive && apt.status !== 'Cancelled' && apt.status !== 'Completed' && (
                          <button
                            type="button"
                            onClick={() => setAppointmentToCancel(apt)}
                            className="p-1 text-slate-400 hover:text-brand-error hover:bg-red-50 rounded transition-colors"
                            title="Cancel Appointment"
                            aria-label={`Cancel appointment for ${apt.patientName}`}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadError && !isLoading && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-brand-border px-4 py-3 text-xs text-brand-muted">
            <span>{pagination.total} appointments</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded border border-brand-border p-1.5 disabled:opacity-40"
                aria-label="Previous appointments page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>Page {currentPage} of {pagination.pages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(pagination.pages, page + 1))}
                disabled={currentPage >= pagination.pages}
                className="rounded border border-brand-border p-1.5 disabled:opacity-40"
                aria-label="Next appointments page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Appointment Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Clinical Appointment"
        subtitle="Book a patient consultation, follow-up, or diagnostic exam."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleScheduleSubmit} noValidate className="space-y-4 text-xs">
          {/* Patient Selection */}
          <div>
            <label
              htmlFor="sched-patient-search"
              className="block text-xs font-semibold text-brand-text mb-1"
            >
              Find patient
            </label>
            <input
              id="sched-patient-search"
              type="search"
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              placeholder="Search patient name, ID, or contact"
              disabled={isSubmittingSchedule}
              className="mb-2 block w-full py-2 px-3 text-xs rounded-md border border-brand-border text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <label
              htmlFor="sched-patient"
              className="block text-xs font-semibold text-brand-text mb-1"
            >
              Patient <span className="text-brand-error">*</span>
            </label>
            <select
              id="sched-patient"
              value={scheduleData.patientId}
              disabled={patients.length === 0 || isLoadingPatients || isSubmittingSchedule}
              onChange={(e) => {
                setScheduleData((prev) => ({ ...prev, patientId: e.target.value }));
                if (scheduleErrors.patientId) setScheduleErrors((prev) => ({ ...prev, patientId: null }));
              }}
              className="block w-full py-2 px-3 text-xs rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="">{isLoadingPatients ? 'Searching patients...' : 'Select a patient'}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
            {scheduleErrors.patientId && (
              <p className="mt-1 text-xs text-brand-error">{scheduleErrors.patientId}</p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sched-date"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Date <span className="text-brand-error">*</span>
              </label>
              <input
                id="sched-date"
                type="date"
                value={scheduleData.date}
                onChange={(e) => {
                  setScheduleData((prev) => ({ ...prev, date: e.target.value }));
                  if (scheduleErrors.date) setScheduleErrors((prev) => ({ ...prev, date: null }));
                }}
                className="block w-full py-2 px-3 text-xs rounded-md border border-brand-border text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              {scheduleErrors.date && (
                <p className="mt-1 text-xs text-brand-error">{scheduleErrors.date}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="sched-time"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Time <span className="text-brand-error">*</span>
              </label>
              <input
                id="sched-time"
                type="text"
                placeholder="e.g. 10:30 AM"
                value={scheduleData.time}
                onChange={(e) => {
                  setScheduleData((prev) => ({ ...prev, time: e.target.value }));
                  if (scheduleErrors.time) setScheduleErrors((prev) => ({ ...prev, time: null }));
                }}
                className="block w-full py-2 px-3 text-xs rounded-md border border-brand-border text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              {scheduleErrors.time && (
                <p className="mt-1 text-xs text-brand-error">{scheduleErrors.time}</p>
              )}
            </div>
          </div>

          {/* Reason / Clinical Purpose */}
          <div>
            <label
              htmlFor="sched-reason"
              className="block text-xs font-semibold text-brand-text mb-1"
            >
              Consultation Reason <span className="text-brand-error">*</span>
            </label>
            <input
              id="sched-reason"
              type="text"
              placeholder="e.g. Post-admission review, wound check, metabolic exam"
              value={scheduleData.reason}
              onChange={(e) => {
                setScheduleData((prev) => ({ ...prev, reason: e.target.value }));
                if (scheduleErrors.reason) setScheduleErrors((prev) => ({ ...prev, reason: null }));
              }}
              className="block w-full py-2 px-3 text-xs rounded-md border border-brand-border text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            {scheduleErrors.reason && (
              <p className="mt-1 text-xs text-brand-error">{scheduleErrors.reason}</p>
            )}
          </div>

          {/* Type & Doctor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sched-type"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Appointment Type
              </label>
              <select
                id="sched-type"
                value={scheduleData.type}
                onChange={(e) => setScheduleData((prev) => ({ ...prev, type: e.target.value }))}
                className="block w-full py-2 px-3 text-xs rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="Clinical Consultation">Clinical Consultation</option>
                <option value="Inpatient Follow-up">Inpatient Follow-up</option>
                <option value="Diagnostic Review">Diagnostic Review</option>
                <option value="Outpatient Care">Outpatient Care</option>
                <option value="Preventive Health">Preventive Health</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="sched-doctor"
                className="block text-xs font-semibold text-brand-text mb-1"
              >
                Assigned Physician
              </label>
              <select
                id="sched-doctor"
                value={scheduleData.doctorId}
                disabled={!doctors.length || doctorsLoading || Boolean(doctorLoadError) || isSubmittingSchedule}
                onChange={(e) => {
                  const doctor = doctors.find(({ id }) => id === e.target.value);
                  setScheduleData((prev) => ({
                    ...prev,
                    doctorId: doctor?.id || '',
                    assignedDoctor: doctor?.name || '',
                  }));
                }}
                className="block w-full py-2 px-3 text-xs rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">
                  {doctorsLoading
                    ? 'Loading doctors...'
                    : doctorLoadError
                      ? 'Unable to load doctors'
                      : doctors.length
                        ? 'Select a doctor'
                        : 'No active doctors'}
                </option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} ({doctor.specialty})
                  </option>
                ))}
              </select>
              {doctorLoadError && (
                <p role="alert" className="mt-1 text-xs text-brand-error">{doctorLoadError}</p>
              )}
              {!doctorsLoading && !doctorLoadError && !doctors.length && (
                <p className="mt-1 text-xs text-amber-700">
                  Add an active doctor before scheduling appointments.
                </p>
              )}
              {scheduleErrors.assignedDoctor && (
                <p className="mt-1 text-xs text-brand-error">{scheduleErrors.assignedDoctor}</p>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-brand-border flex justify-end gap-2.5">
            <SecondaryButton
              size="sm"
              onClick={() => setIsScheduleModalOpen(false)}
              disabled={isSubmittingSchedule}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              size="sm"
              isLoading={isSubmittingSchedule}
              disabled={isSubmittingSchedule || patients.length === 0}
            >
              Book Appointment
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(appointmentForDoctorChange)}
        onClose={() => {
          if (!isSavingDoctor) setAppointmentForDoctorChange(null);
        }}
        title="Change Assigned Doctor"
        subtitle={`Select an active clinician for appointment ${appointmentForDoctorChange?.id || ''}.`}
      >
        <form onSubmit={handleDoctorChange} className="space-y-4">
          {appointmentForDoctorChange && !selectedDoctorId && appointmentForDoctorChange.assignedDoctor && (
            <p className="text-xs text-brand-muted">
              Current assignment: {appointmentForDoctorChange.assignedDoctor}
            </p>
          )}
          {doctorLoadError ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-brand-error">
                Active doctors could not be loaded: {doctorLoadError}
              </p>
              <SecondaryButton
                size="sm"
                onClick={() => setDoctorsLoadKey((key) => key + 1)}
                disabled={doctorsLoading}
              >
                Retry loading doctors
              </SecondaryButton>
            </div>
          ) : doctors.length === 0 ? (
            <p className="text-sm text-amber-800">
              No active doctors are available. Ask an administrator to activate a doctor profile.
            </p>
          ) : (
            <label className="block text-xs font-semibold text-brand-text">
              Active doctor
              <select
                value={selectedDoctorId}
                onChange={(event) => setSelectedDoctorId(event.target.value)}
                disabled={isSavingDoctor}
                className="mt-1 block w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="">Select an active doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} ({doctor.specialty})
                  </option>
                ))}
              </select>
            </label>
          )}
          {actionError && <p role="alert" className="text-xs text-brand-error">{actionError}</p>}
          <div className="flex justify-end gap-2 border-t border-brand-border pt-4">
            <SecondaryButton
              onClick={() => setAppointmentForDoctorChange(null)}
              disabled={isSavingDoctor}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              isLoading={isSavingDoctor}
              disabled={!selectedDoctorId || doctors.length === 0 || Boolean(doctorLoadError)}
            >
              Save Assignment
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(appointmentToCancel)}
        onClose={() => setAppointmentToCancel(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Appointment"
        message={`Are you sure you want to cancel the appointment for ${appointmentToCancel?.patientName} on ${appointmentToCancel?.formattedDate || appointmentToCancel?.date}?`}
        confirmLabel="Cancel Appointment"
        confirmVariant="danger"
        isLoading={isCancelling}
      />
    </PageContainer>
  );
}
