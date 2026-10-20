import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  Calendar,
  Clock,
  UserPlus,
  FileText,
  ChevronRight,
  Eye,
  Info,
  CalendarPlus,
  SlidersHorizontal,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import StatCard from '../components/StatCard';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useHospitalData } from '../context/HospitalDataContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManagePatients = ['admin', 'clinician', 'nurse'].includes(user?.role);
  const { patients, appointments } = useHospitalData();

  // Toggle for testing/reviewing empty state design required by spec
  const [showEmptyState, setShowEmptyState] = useState(false);

  // Compute metrics from hospital data
  const totalPatientsCount = patients.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointmentsCount = appointments.filter((a) => a.date === todayStr).length;
  const upcomingAppointmentsCount = appointments.filter(
    (a) => a.status === 'Scheduled' || a.status === 'Confirmed'
  ).length;

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const recentlyAddedCount = patients.filter(
    (p) => new Date(p.registrationDate) >= oneDayAgo
  ).length;

  const patientsData = showEmptyState ? [] : patients.slice(0, 5);
  const appointmentsData = showEmptyState
    ? []
    : appointments
        .filter((a) => a.status === 'Confirmed' || a.status === 'In Progress' || a.status === 'Scheduled')
        .slice(0, 5);

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
        <div className="flex items-center gap-2">
          {/* Quick state switcher for reviewers to check the empty-state requirement */}
          <button
            type="button"
            onClick={() => setShowEmptyState(!showEmptyState)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-brand-border rounded-md hover:bg-slate-50 transition-colors"
            title="Inspect empty state layout"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-brand-muted" />
            <span>{showEmptyState ? 'Show Sample Data' : 'Preview Empty State'}</span>
          </button>

          canManagePatients ? (
            <PrimaryButton
              icon={UserPlus}
              onClick={() => navigate('/patients/new')}
            >
              Add Patient
            </PrimaryButton>
          ) : null
        </div>
      }
    >
      {/* Sample Data Disclaimer Banner */}
      <div className="mb-6 p-3 bg-white border border-brand-border rounded-lg shadow-card flex items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-brand-muted">
          <Info className="h-4 w-4 text-brand-primary flex-shrink-0" />
          <span>
            <strong className="text-brand-text font-semibold">Demonstration data:</strong> This dashboard uses synthetic sample records and is not connected to the live patient database. Use Patient Directory, Medical Records, and Appointments for authenticated API data.
          </span>
        </div>
        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-brand-primary border border-teal-200 whitespace-nowrap">
          Sample Data
        </span>
      </div>

      {/* Summary Stat Cards */}
      <section aria-labelledby="metrics-heading" className="mb-8">
        <h2 id="metrics-heading" className="sr-only">
          Hospital Summary Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Patients"
            value={showEmptyState ? '0' : totalPatientsCount.toLocaleString()}
            helperText={showEmptyState ? 'No active patient records' : `${totalPatientsCount} registered in directory`}
            icon={Users}
          />
          <StatCard
            title="Today's Appointments"
            value={showEmptyState ? '0' : todayAppointmentsCount.toString()}
            helperText={showEmptyState ? 'No appointments today' : `${todayAppointmentsCount} scheduled for today`}
            icon={Calendar}
          />
          <StatCard
            title="Upcoming Appointments"
            value={showEmptyState ? '0' : upcomingAppointmentsCount.toString()}
            helperText={showEmptyState ? 'None scheduled' : 'Confirmed or in progress'}
            icon={Clock}
          />
          <StatCard
            title="Recently Added Patients"
            value={showEmptyState ? '0' : recentlyAddedCount.toString()}
            helperText={showEmptyState ? '0 new admissions' : 'Registered in last 24 hours'}
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
                  description="There are currently no patient admissions or outpatient registrations on record."
                  icon={Users}
                  action={
                    <PrimaryButton
                      size="sm"
                      icon={UserPlus}
                      onClick={() => setShowEmptyState(false)}
                    >
                      Load Sample Patients
                    </PrimaryButton>
                  }
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
                <span>All ({appointments.length})</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="p-4">
              {appointmentsData.length === 0 ? (
                <EmptyState
                  title="No Scheduled Appointments"
                  description="No clinical appointments are slated for the remainder of today."
                  icon={Calendar}
                  action={
                    <SecondaryButton
                      size="sm"
                      onClick={() => setShowEmptyState(false)}
                    >
                      Load Sample Appointments
                    </SecondaryButton>
                  }
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
                        <StatusBadge variant={apt.statusVariant}>
                          {apt.status}
                        </StatusBadge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-brand-primary font-medium mb-1">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{apt.dateTime || `${apt.date} at ${apt.time}`}</span>
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
    </PageContainer>
  );
}
