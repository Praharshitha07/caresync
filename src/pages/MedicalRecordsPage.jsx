import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  PlusCircle,
  Eye,
  RotateCcw,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import PageContainer from '../components/PageContainer';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { listMedicalRecords } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MedicalRecordsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = ['admin', 'clinician', 'nurse'].includes(user?.role);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadKey, setLoadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedRecordForView, setSelectedRecordForView] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = { page: String(currentPage), limit: '50' };
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (dateFilter !== 'all') {
      const from = new Date();
      from.setDate(from.getDate() - (dateFilter === 'last7' ? 7 : 30));
      params.from = from.toISOString().slice(0, 10);
      params.to = new Date().toISOString().slice(0, 10);
    }
    setIsLoading(true);
    setLoadError('');
    const timer = window.setTimeout(() => {
      listMedicalRecords(params, { signal: controller.signal })
        .then((response) => {
          setMedicalRecords(response.data);
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
  }, [currentPage, dateFilter, loadKey, searchQuery]);

  const filteredRecords = medicalRecords;

  const handleResetFilters = () => {
    setSearchQuery('');
    setDateFilter('all');
    setCurrentPage(1);
  };

  return (
    <PageContainer
      title="Medical Records"
      subtitle="Comprehensive clinical progress dossiers, diagnostic encounter notes, and active treatment regimens."
      actions={
        canCreate ? (
          <PrimaryButton
            icon={PlusCircle}
            onClick={() => navigate('/medical-records/new')}
          >
            Add Medical Record
          </PrimaryButton>
        ) : null
      }
    >
      {/* Search & Filter Bar */}
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
              placeholder="Search by patient ID, diagnosis, or physician..."
              ariaLabel="Search medical records"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-1.5">
            <label htmlFor="record-date-filter" className="text-xs font-semibold text-brand-muted whitespace-nowrap">
              Visit Date:
            </label>
            <select
              id="record-date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full text-xs py-2 px-2.5 rounded-md border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="all">All Dates</option>
              <option value="last7">Past 7 Days</option>
              <option value="last30">Past 30 Days</option>
            </select>
          </div>

          <div className="md:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="p-2 text-xs text-brand-muted hover:text-brand-text hover:bg-slate-100 rounded-md transition-colors border border-brand-border"
              aria-label="Clear filters"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Record Table / List */}
      <div className="bg-white rounded-lg border border-brand-border shadow-card overflow-hidden">
        {loadError ? (
          <div className="p-6">
            <ErrorState message={loadError} onRetry={() => setLoadKey((key) => key + 1)} />
          </div>
        ) : isLoading ? (
          <LoadingState message="Loading medical records..." />
        ) : filteredRecords.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Medical Records Found"
              description={
                searchQuery || dateFilter !== 'all'
                  ? 'No clinical records matched your search parameters.'
                  : 'There are currently no clinical encounter records filed in the system.'
              }
              icon={FileText}
              action={
                searchQuery || dateFilter !== 'all' ? (
                  <SecondaryButton size="sm" onClick={handleResetFilters}>
                    Clear Filters
                  </SecondaryButton>
                ) : canCreate ? (
                  <PrimaryButton
                    size="sm"
                    icon={PlusCircle}
                    onClick={() => navigate('/medical-records/new')}
                  >
                    Create First Medical Record
                  </PrimaryButton>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-border text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-brand-muted uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Record ID</th>
                  <th scope="col" className="px-4 py-3">Patient</th>
                  <th scope="col" className="px-4 py-3">Visit Date</th>
                  <th scope="col" className="px-4 py-3">Primary Diagnosis</th>
                  <th scope="col" className="px-4 py-3">Attending Physician</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border bg-white">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold text-brand-primary bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {record.id}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Link
                        to={`/patients/${record.patientId}`}
                        className="font-medium text-brand-text hover:text-brand-primary transition-colors block"
                      >
                        Patient {record.patientId}
                      </Link>
                      <span className="font-mono text-[11px] text-brand-muted">
                        {record.patientId}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                      {record.formattedVisitDate || record.visitDate}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-brand-text max-w-xs">
                      <span className="font-semibold block truncate">
                        {record.diagnosis}
                      </span>
                      <span className="text-slate-500 line-clamp-1">
                        {record.treatment}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                      <span className="font-medium block">{record.attendingPhysician}</span>
                      <span className="text-[11px] text-brand-muted">{record.department}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedRecordForView(record)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand-primary bg-teal-50 hover:bg-teal-100 rounded transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Dossier</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadError && !isLoading && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-brand-border px-4 py-3 text-xs text-brand-muted">
            <span>{pagination.total} medical records</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded border border-brand-border p-1.5 disabled:opacity-40"
                aria-label="Previous records page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>Page {currentPage} of {pagination.pages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(pagination.pages, page + 1))}
                disabled={currentPage >= pagination.pages}
                className="rounded border border-brand-border p-1.5 disabled:opacity-40"
                aria-label="Next records page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Clinical Record Modal */}
      {selectedRecordForView && (
        <Modal
          isOpen={Boolean(selectedRecordForView)}
          onClose={() => setSelectedRecordForView(null)}
          title={`Clinical Encounter: ${selectedRecordForView.id}`}
          subtitle={`Patient: ${selectedRecordForView.patientId}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-md border border-brand-border">
              <span className="text-brand-muted block font-semibold mb-0.5">Primary Clinical Diagnosis</span>
              <p className="text-sm font-bold text-brand-text">{selectedRecordForView.diagnosis}</p>
            </div>

            <div>
              <span className="text-brand-muted block font-semibold mb-1">Administered Treatment Plan</span>
              <div className="text-slate-800 leading-relaxed bg-white p-3 rounded border border-brand-border">
                {selectedRecordForView.treatment}
              </div>
            </div>

            <div>
              <span className="text-brand-muted block font-semibold mb-1">Prescribed Pharmacotherapy</span>
              <div className="text-slate-800 leading-relaxed bg-white p-3 rounded border border-brand-border font-mono text-[11px]">
                {selectedRecordForView.prescriptions}
              </div>
            </div>

            <div>
              <span className="text-brand-muted block font-semibold mb-1">Physician Progress & Chart Notes</span>
              <div className="text-slate-800 leading-relaxed bg-white p-3 rounded border border-brand-border">
                {selectedRecordForView.clinicalNotes}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-brand-border text-brand-muted">
              <div>
                <span className="block font-medium">Attending Physician:</span>
                <span className="text-brand-text font-semibold">{selectedRecordForView.attendingPhysician}</span>
              </div>
              <div>
                <span className="block font-medium">Department Unit:</span>
                <span className="text-brand-text font-semibold">{selectedRecordForView.department}</span>
              </div>
            </div>

            {selectedRecordForView.followUpDate && (
              <div className="p-2.5 rounded bg-amber-50/70 border border-amber-200 text-amber-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span>Follow-up consultation scheduled on: <strong>{selectedRecordForView.followUpDate}</strong></span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
