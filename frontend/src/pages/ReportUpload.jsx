import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddressInput from '../components/AddressInput';

const REPORT_KINDS = [
  { value: 'personal', label: 'Personal' },
  { value: 'clearance', label: 'Clearance' },
  { value: 'area', label: 'Area' },
];

export default function ReportUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reportKind, setReportKind] = useState('');

  const [reportDate, setReportDate] = useState('');
  const [address, setAddress] = useState({});
  const [locationLabel, setLocationLabel] = useState('');
  const [locationOptions, setLocationOptions] = useState([]);
  const [workerName, setWorkerName] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const roleLevel = Math.max(...((user?.roles || []).map(r => r.level || 0)), 0);
  const isManagerPlus = !!(user?.is_superuser || roleLevel >= 90);

  const selectedProject = useMemo(() => projects.find(p => String(p.id) === String(selectedProjectId)), [projects, selectedProjectId]);

  useEffect(() => {
    const run = async () => {
      if (!isManagerPlus) {
        navigate('/dashboard', { replace: true });
        return;
      }

      try {
        const resp = await api.get('/api/v1/companies/');
        setCompanies(resp.data || []);
      } catch (err) {
        console.error('Failed to fetch companies:', err);
        setError('Failed to load companies');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [isManagerPlus, navigate]);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!selectedCompanyId) {
        setProjects([]);
        setSelectedProjectId('');
        setReportKind('');
        return;
      }

      setError('');
      setSuccess('');
      setSelectedProjectId('');
      setReportKind('');
      setProjects([]);

      try {
        const resp = await api.get(`/api/v1/companies/${selectedCompanyId}/projects`);
        setProjects(resp.data.projects || []);
      } catch (err) {
        console.error('Failed to fetch company projects:', err);
        setError('Failed to load projects for that company');
      }
    };

    fetchProjects();
  }, [selectedCompanyId]);

  useEffect(() => {
    // Reset downstream fields when project or report kind changes.
    setReportDate('');
    setAddress({});
    setLocationLabel('');
    setLocationOptions([]);
    setWorkerName('');
    setNotes('');
    setFile(null);
  }, [selectedProjectId, reportKind]);

  useEffect(() => {
    const loadLocationOptions = async () => {
      const pid = selectedProjectId;
      const placeId = address?.google_place_id;
      if (!pid || !placeId) {
        setLocationOptions([]);
        return;
      }

      try {
        const resp = await api.get('/api/v1/reports/locations', {
          params: { project_id: pid, google_place_id: placeId },
        });
        setLocationOptions(resp.data || []);
      } catch (err) {
        // Non-fatal; still allow freeform location.
        console.warn('Failed to load prior location labels:', err);
        setLocationOptions([]);
      }
    };

    loadLocationOptions();
  }, [address?.google_place_id, selectedProjectId]);

  const canShowProjectSelect = !!selectedCompanyId;
  const canShowKindSelect = !!selectedProjectId;
  const canShowForm = !!selectedProjectId && !!reportKind;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedCompanyId) {
      setError('Please select a company');
      return;
    }

    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }

    if (!reportKind) {
      setError('Please select a report type');
      return;
    }

    if (!reportDate) {
      setError('Report date is required');
      return;
    }

    if (!address?.google_place_id || !address?.formatted_address) {
      setError('Location is required (select an address from Google Places)');
      return;
    }

    if (reportKind === 'personal' && !workerName.trim()) {
      setError('Worker name is required for Personal reports');
      return;
    }

    if (!file) {
      setError('Please choose a PDF file');
      return;
    }

    const filename = (file.name || '').toLowerCase();
    if (!(file.type === 'application/pdf' || filename.endsWith('.pdf'))) {
      setError('Only PDF files are supported');
      return;
    }

    try {
      setSubmitting(true);

      const data = new FormData();
      data.append('project_id', String(selectedProjectId));
      data.append('report_kind', reportKind);
      data.append('report_date', reportDate);
      data.append('formatted_address', address.formatted_address);
      data.append('google_place_id', address.google_place_id);
      if (address.latitude != null) data.append('latitude', String(address.latitude));
      if (address.longitude != null) data.append('longitude', String(address.longitude));
      if (locationLabel.trim()) data.append('location_label', locationLabel.trim());
      if (reportKind === 'personal') data.append('worker_name', workerName.trim());
      if (notes.trim()) data.append('notes', notes.trim());
      data.append('file', file);

      await api.post('/api/v1/reports/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess('Report uploaded successfully');
      // Keep the selections but clear form content so the user can upload another.
      setReportDate('');
      setAddress({});
      setLocationLabel('');
      setWorkerName('');
      setNotes('');
      setFile(null);
    } catch (err) {
      console.error('Upload failed:', err);
      const detail = err?.response?.data?.detail;
      setError(detail || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Upload Report</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
        {/* Step 1: company */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select a company...</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Step 2: project */}
        {canShowProjectSelect && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedProject && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {selectedProject.status ? `Status: ${selectedProject.status}` : null}
              </div>
            )}
          </div>
        )}

        {/* Step 3: report kind */}
        {canShowKindSelect && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Report Type</label>
            <select
              value={reportKind}
              onChange={(e) => setReportKind(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select a type...</option>
              {REPORT_KINDS.map(k => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Details */}
        {canShowForm && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Report Date</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              {reportKind === 'personal' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Worker Name</label>
                  <input
                    type="text"
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Worker name"
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <AddressInput
                value={address}
                onChange={setAddress}
                required
                showLocationName={false}
              />
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pick the address from Google Places (manual entry will not work for uploads).
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location (optional)</label>
              <input
                type="text"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                list="report-location-options"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="e.g. Boiler Room"
              />
              <datalist id="report-location-options">
                {locationOptions.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Suggestions are populated from prior uploads for the same address.
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">PDF File</label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm text-gray-700 dark:text-gray-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {submitting ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
