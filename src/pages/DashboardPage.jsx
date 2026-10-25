import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  Calendar,
  Clock,
  UserPlus,
  FileText,
  ChevronRight,
  Eye,
  CalendarPlus,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import StatCard from '../components/StatCard';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { getDashboardSummary } from '../services/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManagePatients = ['admin', 'doctor', 'clinician', 'nurse'].includes(user?.role);
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    getDashboardSummary({ signal: controller.signal })
      .then(setDashboard)
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);
  const stats = dashboard?.stats || {};
  const patientsData = dashboard?.recentPatients || [];
  const appointmentsData = dashboard?.upcomingAppointments || [];
  const totalPatientsCount = stats?.totalPatients ?? 0;

  // Column configuration for Recent Patients Table
  const patientColumns = [
    {
      key: 'id',
      header: 'Patient ID',
      render: (row) => (
        <Link
          to={`/patients/${row.id}`}
          className="font-mono text-xs font-semibold text-brand-dark bg-teal-50/70 px-2 py-0.5 rounded border border-teal-200/60 hover:bg-teal-100 transition-colors"
        >
          {row.id}
        </Link>
      ),
    },
    {
      key: 'name',
      header: 'Patient Name',
      render: (row) => (
        <div>
          <Link
            to={`/patients/${row.id}`}
            className="font-medium text-brand-text hover:text-brand-primary transition-colors block"
          >
            {row.name}
          </Link>
          <span className="text-xs text-brand-muted">
            {row.age} yrs • {row.gender}
          </span>
        </div>
      ),
    },
    {
      key: 'doctorName',
      header: 'Attending Doctor',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.doctorName || 'Not assigned'}
        </span>
      ),
    },
    {
      key: 'registrationDate',
      header: 'Registration Date',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.formattedRegDate || row.registrationDate}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge variant={row.statusVariant}>
          {row.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate(`/patients/${row.id}`)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand-primary bg-teal-50 hover:bg-teal-100 rounded transition-colors"
            aria-label={`View record for ${row.name}`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer
      title="Dashboard"
      subtitle={`Welcome back, ${user?.displayName || 'staff member'}. Clinical overview and hospital activity for today.`}
      actions={
        canManagePatients ? (
          <PrimaryButton
            icon={UserPlus}
            onClick={() => navigate('/patients/new')}
          >
            Add Patient
          </PrimaryButton>
        ) : null
      }
    >
      {isLoading ? (
        <LoadingState message="Loading live hospital dashboard..." />
      ) : loadError ? (
        <ErrorState
          title="Unable to Load Dashboard"
          message={loadError}
          onRetry={retry}
        />
      ) : (
      <>

      {/* Summary Stat Cards */}
      <section aria-labelledby="metrics-heading" className="mb-8">
        <h2 id="metrics-heading" className="sr-only">
          Hospital Summary Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Patients"
            value={totalPatientsCount.toLocaleString()}
            helperText={`${totalPatientsCount} active records in directory`}
            icon={Users}
          />
          <StatCard
            title="Today's Appointments"
            value={(stats.todayAppointments ?? 0).toString()}
            helperText={`${stats.todayAppointments ?? 0} scheduled for today`}
            icon={Calendar}
          />
          <StatCard
            title="Upcoming Appointments"
            value={(stats.upcomingAppointments ?? 0).toString()}
            helperText="Scheduled or confirmed"
            icon={Clock}
          />
          <StatCard
            title="Recently Added Patients"
            value={(stats.recentlyAddedPatients ?? 0).toString()}
            helperText="Registered in the last 24 hours"
            icon={UserPlus}
          />
        </div>
      </section>

      {/* Quick Actions Bar */}
      <section aria-labelledby="quick-actions-heading" className="mb-8">
        <div className="bg-white rounded-lg border border-brand-border p-4 shadow-card">
          <h2
            id="quick-actions-heading"
            className="text-xs font-semibold uppercase tracking-wider text-brand-muted mb-3"
          >
            Quick Clinical Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {canManagePatients && <button
              type="button"
              onClick={() => navigate('/patients/new')}
              className="flex items-center gap-3 p-3 rounded-md border border-brand-border hover:border-brand-primary/50 hover:bg-teal-50/40 text-left transition-colors group"
            >
              <div className="p-2 rounded bg-teal-50 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <UserPlus className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-brand-text block">
                  Register Patient
                </span>
                <span className="text-xs text-brand-muted">
                  New inpatient or outpatient intake
                </span>
              </div>
            </button>}

            <button
              type="button"
              onClick={() => navigate('/appointments')}
              className="flex items-center gap-3 p-3 rounded-md border border-brand-border hover:border-brand-primary/50 hover:bg-teal-50/40 text-left transition-colors group"
            >
              <div className="p-2 rounded bg-teal-50 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <CalendarPlus className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-brand-text block">
                  Schedule Appointment
                </span>
                <span className="text-xs text-brand-muted">
                  Book consultation or lab follow-up
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/medical-records')}
              className="flex items-center gap-3 p-3 rounded-md border border-brand-border hover:border-brand-primary/50 hover:bg-teal-50/40 text-left transition-colors group"
            >
              <div className="p-2 rounded bg-teal-50 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-brand-text block">
                  View Patient Records
                </span>
                <span className="text-xs text-brand-muted">
                  Search medical history & charts
                </span>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Main Grid: Recent Patients & Upcoming Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols on lg): Recent Patients Table */}
        <section aria-labelledby="recent-patients-heading" className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-brand-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
              <div>
                <h2
                  id="recent-patients-heading"
                  className="text-base font-bold text-brand-text"
                >
                  Recent Patients
                </h2>
                <p className="text-xs text-brand-muted mt-0.5">
                  Latest registered patients and status classifications
                </p>
              </div>
              <Link
                to="/patients"
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
              >
                <span>View Directory ({totalPatientsCount})</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="p-4">
              {patientsData.length === 0 ? (
                <EmptyState
                  title="No Registered Patients"
                  description="There are no patient records yet. Register your first patient to get started."
                  icon={Users}
                  action={canManagePatients ? (
                    <PrimaryButton size="sm" icon={UserPlus} onClick={() => navigate('/patients/new')}>
                      Register First Patient
                    </PrimaryButton>
                  ) : null}
                />
              ) : (
                <DataTable
                  columns={patientColumns}
                  data={patientsData}
                  keyField="id"
                />
              )}
            </div>
          </div>
        </section>

        {/* Right Column (1 Col on lg): Upcoming Appointments */}
        <section aria-labelledby="upcoming-appointments-heading">
          <div className="bg-white rounded-lg border border-brand-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
              <div>
                <h2
                  id="upcoming-appointments-heading"
                  className="text-base font-bold text-brand-text"
                >
                  Upcoming Appointments
                </h2>
                <p className="text-xs text-brand-muted mt-0.5">
                  Scheduled clinical consults
                </p>
              </div>
              <Link
                to="/appointments"
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
              >
                <span>All</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="p-4">
              {appointmentsData.length === 0 ? (
                <EmptyState
                  title="No Scheduled Appointments"
                  description="There are no upcoming appointments. Schedule the first appointment when you're ready."
                  icon={Calendar}
                  action={canManagePatients ? (
                    <SecondaryButton
                      size="sm"
                      onClick={() => navigate('/appointments')}
                    >
                      Schedule Appointment
                    </SecondaryButton>
                  ) : null}
                />
              ) : (
                <div className="space-y-3">
                  {appointmentsData.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-3.5 rounded-md border border-brand-border hover:border-slate-300 transition-colors bg-white"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-brand-text">
                          {apt.patientName}
                        </span>
                        <StatusBadge
                          variant={
                            apt.status === 'Confirmed'
                              ? 'success'
                              : apt.status === 'In Progress'
                                ? 'warning'
                                : 'info'
                          }
                        >
                          {apt.status}
                        </StatusBadge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-brand-primary font-medium mb-1">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          {new Date(`${apt.date}T00:00:00`).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          at {apt.time}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-1 mb-1">
                        {apt.reason}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-brand-muted">
                        <span>{apt.type}</span>
                        {apt.patientId && (
                          <span className="font-mono">{apt.patientId}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      </>
      )}
    </PageContainer>
  );
}
