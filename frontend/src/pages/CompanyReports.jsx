import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatCompanyName } from '../utils/textUtils';
import {
  getReportDownloadFilename,
  getReportKindLabel,
  getReportTitle,
  getTechnicianDisplayName,
  getUploaderDisplayName,
} from '../utils/reportUtils';

export default function CompanyReports() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [company, setCompany] = useState(null);
  const [reports, setReports] = useState([]);
  const [downloadingReportId, setDownloadingReportId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedKinds, setSelectedKinds] = useState([]);
  const [selectedUploaders, setSelectedUploaders] = useState([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const userRoleLevel = Math.max(...(user?.roles?.map(role => role.level) || [0]));
  const isSupervisorOrHigher = userRoleLevel >= 80;
  const isManagerOrHigher = user?.is_superuser || userRoleLevel >= 90;

  useEffect(() => {
    if (!isSupervisorOrHigher) {
      navigate('/dashboard', { replace: true });
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const [companyResp, reportsResp] = await Promise.all([
          api.get(`/api/v1/companies/${companyId}`),
          api.get('/api/v1/reports/', { params: { company_id: companyId } }),
        ]);

        if (cancelled) return;

        setCompany(companyResp.data);
        setReports(reportsResp.data || []);
      } catch (err) {
        console.error('Error loading company reports:', err);
        if (!cancelled) setError('Failed to load reports');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [companyId, isSupervisorOrHigher, navigate]);

  const sortedReports = useMemo(() => {
    const copy = [...(reports || [])];
    copy.sort((a, b) => {
      const ad = a.report_date || a.generated_at;
      const bd = b.report_date || b.generated_at;
      return String(bd || '').localeCompare(String(ad || ''));
    });
    return copy;
  }, [reports]);


  const downloadReport = async (report) => {
    try {
      setError('');
      setDownloadingReportId(report.id);

      const response = await api.get(`/api/v1/reports/${report.id}/download`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const base = getReportDownloadFilename(report) || `report_${report.id}`;
      a.download = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download report');
    } finally {
      setDownloadingReportId(null);
    }
  };

  const kindOptions = useMemo(() => {
    const set = new Set();
    for (const r of reports || []) {
      const label = getReportKindLabel(r.report_kind);
      if (label) set.add(label);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const uploaderOptions = useMemo(() => {
    const set = new Set();
    for (const r of reports || []) {
      const name = getUploaderDisplayName(r);
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const technicianOptions = useMemo(() => {
    const set = new Set();
    for (const r of reports || []) {
      const name = getTechnicianDisplayName(r);
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const filteredReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;

    return (sortedReports || []).filter((r) => {
      const kindLabel = getReportKindLabel(r.report_kind);
      const uploader = getUploaderDisplayName(r);
      const technician = getTechnicianDisplayName(r);

      if (selectedKinds.length > 0 && !selectedKinds.includes(kindLabel)) return false;
      if (selectedUploaders.length > 0 && !selectedUploaders.includes(uploader)) return false;
      if (selectedTechnicians.length > 0 && !selectedTechnicians.includes(technician)) return false;

      const dateVal = r.report_date || r.generated_at;
      if (from || to) {
        const d = dateVal ? new Date(dateVal) : null;
        if (d && from && d < from) return false;
        if (d && to) {
          const end = new Date(to);
          end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
      }

      if (!term) return true;

      const haystack = [
        getReportTitle(r),
        uploader,
        technician,
        kindLabel,
        r.project_name,
        r.formatted_address,
        r.location_label,
        r.worker_name,
        r.report_date,
        r.generated_at,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [
    dateFrom,
    dateTo,
    searchTerm,
    selectedKinds,
    selectedTechnicians,
    selectedUploaders,
    sortedReports,
  ]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/companies')}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Companies
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Company Reports</h1>
        {company?.name && (
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{formatCompanyName(company.name)}</div>
        )}
      </div>

      {/* Search + filters */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by uploader, technician, type, date, or address..."
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
            />
          </div>
          {isManagerOrHigher && (
            <button
              type="button"
              onClick={() => navigate(`/reports/upload?companyId=${companyId}`)}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Upload Report
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {showFilters ? 'Hide Filters' : 'Filters'}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Report Type</div>
                <div className="space-y-2">
                  {kindOptions.map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedKinds.includes(k)}
                        onChange={() => {
                          setSelectedKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
                        }}
                      />
                      <span>{k}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Uploaded By</div>
                <div className="space-y-2 max-h-48 overflow-auto pr-1">
                  {uploaderOptions.map((u) => (
                    <label key={u} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedUploaders.includes(u)}
                        onChange={() => {
                          setSelectedUploaders((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));
                        }}
                      />
                      <span className="truncate" title={u}>{u}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Technician</div>
                <div className="space-y-2 max-h-48 overflow-auto pr-1">
                  {technicianOptions.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedTechnicians.includes(t)}
                        onChange={() => {
                          setSelectedTechnicians((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
                        }}
                      />
                      <span className="truncate" title={t}>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Date Range</div>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKinds([]);
                      setSelectedUploaders([]);
                      setSelectedTechnicians([]);
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No matching reports</h3>
          <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredReports.map((r) => {
              const kindLabel = getReportKindLabel(r.report_kind);
              const uploader = getUploaderDisplayName(r);
              const technician = getTechnicianDisplayName(r);

              return (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {getReportTitle(r)}
                      </div>
                      {kindLabel && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {kindLabel}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {r.project_name ? `${r.project_name} • ` : ''}
                      {r.formatted_address || ''}
                      {r.location_label ? ` (${r.location_label})` : ''}
                      {r.worker_name ? ` • ${r.worker_name}` : ''}
                    </div>

                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      {uploader ? <span><span className="font-medium">Uploaded by:</span> {uploader}</span> : null}
                      {technician ? <span className="ml-3"><span className="font-medium">Technician:</span> {technician}</span> : null}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/reports/${r.id}`)}
                      className="px-3 py-2 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      View
                    </button>
                    {r.project_id && (
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${r.project_id}`)}
                        className="px-3 py-2 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Open Project
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => downloadReport(r)}
                      disabled={downloadingReportId === r.id}
                      className="px-3 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {downloadingReportId === r.id ? 'Downloading...' : 'Download PDF'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
