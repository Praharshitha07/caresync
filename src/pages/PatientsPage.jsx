import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Eye,
  Edit2,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import StatCard from '../components/StatCard';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { archivePatient, listPatients } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PatientsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManagePatients = ['admin', 'doctor', 'clinician', 'nurse', 'receptionist'].includes(user?.role);
  const canViewPatientDetails = user?.role !== 'receptionist';
  const canEditPatients = ['admin', 'doctor', 'clinician', 'nurse'].includes(user?.role);
  const canEditDemographics = user?.role === 'receptionist';
  const canArchivePatients = user?.role === 'admin';
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortField, setSortField] = useState('registrationDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [pagination, setPagination] = useState({
    total: 0,
    activeTotal: 0,
    pages: 0,
    recentCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [patientToDelete, setPatientToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsLoading(true);
      setLoadError('');
      listPatients(
        {
          page: String(currentPage),
          limit: String(itemsPerPage),
          search: searchQuery.trim(),
          registered: dateFilter,
          sort: sortField,
          order: sortOrder,
        },
        { signal: controller.signal }
      )
        .then((response) => {
          setPatients(response.data);
          setPagination(response.pagination);
        })
        .catch((error) => {
          if (error.name !== 'AbortError') {
            setLoadError(error.message);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [currentPage, dateFilter, itemsPerPage, reloadKey, searchQuery, sortField, sortOrder]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setDateFilter('all');
    setSortField('registrationDate');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const handleDeleteConfirm = async () => {
    if (!patientToDelete) return;
    setIsDeleting(true);
    setActionError('');
    try {
      await archivePatient(patientToDelete.id);
      setIsDeleting(false);
      setFeedbackMessage(`Patient record ${patientToDelete.id} (${patientToDelete.name}) archived.`);
      setPatientToDelete(null);
      if (patients.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        setReloadKey((prev) => prev + 1);
      }
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageContainer
      title="Patient Directory"
      subtitle="Search, view, and manage comprehensive patient profiles, admissions, and contact details."
      actions={
        canManagePatients ? (
          <PrimaryButton
            icon={UserPlus}
            onClick={() => navigate('/patients/new')}
          >
            Register Patient
          </PrimaryButton>
        ) : null
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard
          title="Total Registered Patients"
          value={pagination.activeTotal.toLocaleString()}
          helperText="Active records in hospital system"
          icon={Users}
        />
        <StatCard
          title="Recently Registered Patients"
          value={pagination.recentCount.toString()}
          helperText="Registered in the last 7 days"
          icon={Clock}
        />
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="bg-white rounded-lg border border-brand-border p-4 shadow-card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-5">
            <SearchInput
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              onClear={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              placeholder="Search by name, ID, phone, or email..."
              ariaLabel="Search patients"
            />
          </div>

          {/* Registration Date Filter */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <label htmlFor="reg-date-filter" className="text-xs font-semibold text-brand-muted whitespace-nowrap">
              Registered:
            </label>
            <select
              id="reg-date-filter"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="all">All Dates</option>
              <option value="last7">Past 7 Days</option>
              <option value="last30">Past 30 Days</option>
            </select>
          </div>

          {/* Sort By Field */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <label htmlFor="sort-filter" className="text-xs font-semibold text-brand-muted whitespace-nowrap">
              Sort:
            </label>
            <select
              id="sort-filter"
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split('-');
                setSortField(f);
                setSortOrder(o);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="registrationDate-desc">Newest First</option>
              <option value="registrationDate-asc">Oldest First</option>
              <option value="name-asc">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div className="md:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="p-2 text-xs text-brand-muted hover:text-brand-text hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 border border-brand-border"
              aria-label="Clear all filters"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Patient Table or Empty State */}
      <div className="bg-white rounded-lg border border-brand-border shadow-card overflow-hidden">
        {actionError && (
          <p role="alert" className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {actionError}
          </p>
        )}
        {loadError ? (
          <div className="p-6">
            <ErrorState message={loadError} onRetry={() => setReloadKey((prev) => prev + 1)} />
          </div>
        ) : isLoading ? (
          <LoadingState message="Loading patients..." />
        ) : patients.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Patients Found"
              description={
                searchQuery || dateFilter !== 'all'
                  ? 'No patient records matched your active filter or search criteria.'
                  : 'There are currently no patients registered in the hospital directory.'
              }
              icon={Users}
              action={
                searchQuery || dateFilter !== 'all' ? (
                  <SecondaryButton size="sm" onClick={handleResetFilters}>
                    Clear Filters
                  </SecondaryButton>
                ) : canManagePatients ? (
                  <PrimaryButton
                    size="sm"
                    icon={UserPlus}
                    onClick={() => navigate('/patients/new')}
                  >
                    {canManagePatients ? 'Register First Patient' : 'No patients found'}
                  </PrimaryButton>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-border text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-brand-muted uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 py-3">Patient ID</th>
                    <th scope="col" className="px-4 py-3">Patient Name</th>
                    {canViewPatientDetails && <th scope="col" className="px-4 py-3">Date of Birth</th>}
                    <th scope="col" className="px-4 py-3">Contact Information</th>
                    <th scope="col" className="px-4 py-3">Attending Doctor</th>
                    <th scope="col" className="px-4 py-3">Registration Date</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border bg-white">
                  {patients.map((patient) => (
                    <tr
                      key={patient.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Patient ID */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {canViewPatientDetails ? (
                          <Link
                            to={`/patients/${patient.id}`}
                            className="font-mono text-xs font-semibold text-brand-primary bg-teal-50 px-2 py-0.5 rounded border border-teal-200 hover:bg-teal-100 transition-colors"
                          >
                            {patient.id}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs font-semibold text-brand-text">{patient.id}</span>
                        )}
                      </td>

                      {/* Name, Age, Gender */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-brand-text">
                          {canViewPatientDetails ? (
                            <Link to={`/patients/${patient.id}`} className="hover:text-brand-primary transition-colors">
                              {patient.name}
                            </Link>
                          ) : patient.name}
                        </div>
                        {canViewPatientDetails && (
                          <div className="text-xs text-brand-muted">
                            {patient.age} yrs • {patient.gender}
                          </div>
                        )}
                      </td>

                      {/* Date of Birth */}
                      {canViewPatientDetails && (
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                          {patient.dob || '—'}
                        </td>
                      )}

                      {/* Contact Info */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-xs text-brand-text font-medium">
                          {patient.phone || '—'}
                        </div>
                        {patient.email && (
                          <div className="text-xs text-brand-muted truncate max-w-[180px]">
                            {patient.email}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {patient.doctorName || 'Not assigned'}
                      </td>

                      {/* Registration Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {patient.formattedRegDate || patient.registrationDate}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          {canViewPatientDetails && <button
                            type="button"
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            title="View Patient Dossier"
                            className="p-1.5 text-brand-primary hover:bg-teal-50 rounded transition-colors"
                            aria-label={`View record for ${patient.name}`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>}
                          {canEditPatients && (
                            <button
                              type="button"
                              onClick={() => navigate(`/patients/${patient.id}/edit`)}
                              title="Edit Patient Profile"
                              className="p-1.5 text-slate-600 hover:text-brand-primary hover:bg-slate-100 rounded transition-colors"
                              aria-label={`Edit ${patient.name}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canEditDemographics && (
                            <button
                              type="button"
                              onClick={() => navigate(`/patients/${patient.id}/edit-demographics`)}
                              title="Edit Patient Demographics"
                              className="p-1.5 text-slate-600 hover:text-brand-primary hover:bg-slate-100 rounded transition-colors"
                              aria-label={`Edit demographics for ${patient.name}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canArchivePatients && (
                            <button
                              type="button"
                              onClick={() => setPatientToDelete(patient)}
                              title="Archive Patient Record"
                              className="p-1.5 text-slate-400 hover:text-brand-error hover:bg-red-50 rounded transition-colors"
                              aria-label={`Archive record for ${patient.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-4 py-3 bg-slate-50 border-t border-brand-border flex items-center justify-between text-xs text-brand-muted">
              <div>
                Showing{' '}
                <span className="font-semibold text-brand-text">
                  {pagination.total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-brand-text">
                  {Math.min(currentPage * itemsPerPage, pagination.total)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-brand-text">
                  {pagination.total}
                </span>{' '}
                patients
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-brand-border bg-white text-brand-text hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <span>
                  Page {currentPage} of {Math.max(pagination.pages, 1)}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(Math.max(pagination.pages, 1), p + 1))}
                  disabled={currentPage >= Math.max(pagination.pages, 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-brand-border bg-white text-brand-text hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Archive Confirmation Modal */}
      {canArchivePatients && <ConfirmDialog
        isOpen={Boolean(patientToDelete)}
        onClose={() => setPatientToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Archive Patient Record"
        message={`Archive ${patientToDelete?.name} (${patientToDelete?.id}) from the active directory? Existing clinical history is not deleted.`}
        confirmLabel="Archive Record"
        confirmVariant="danger"
        isLoading={isDeleting}
      />}
    </PageContainer>
  );
}
