import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddressInput from '../components/AddressInput';
import { formatPersonName, toTitleCase } from '../utils/textUtils';
import { hasStreetNumber, normalizeReportAddress } from '../utils/reportUtils';

const REPORT_KINDS = [
  { value: 'personal', label: 'Personal' },
  { value: 'clearance', label: 'Clearance' },
  { value: 'area', label: 'Area' },
];

export default function ReportUpload() {
  const { user, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const refreshedOnce = useRef(false);
  const pendingProjectId = useRef(null);
  const prefillApplied = useRef(false);

  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reportKind, setReportKind] = useState('');

  const [reportDate, setReportDate] = useState('');
  const [address, setAddress] = useState({});
  const [streetNumber, setStreetNumber] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [locationOptions, setLocationOptions] = useState([]);
  const [workerName, setWorkerName] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [technicianUserId, setTechnicianUserId] = useState(null);
  const [technicianSuggestions, setTechnicianSuggestions] = useState([]);
  const [technicianMenuOpen, setTechnicianMenuOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const prefillCompanyId = searchParams.get('companyId');
  const prefillProjectId = searchParams.get('projectId');

  const selectedProject = useMemo(() => projects.find(p => String(p.id) === String(selectedProjectId)), [projects, selectedProjectId]);

  const filteredTechnicians = useMemo(() => {
    const term = technicianName.trim().toLowerCase();
    const options = technicianSuggestions || [];
    if (!term) return options;

    return options.filter((t) => {
      const haystack = [t.name, t.email, t.assigned ? 'assigned' : 'employee']
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [technicianName, technicianSuggestions]);

  const chooseTechnician = (tech) => {
    setSelectedTechnician(tech);
    setTechnicianUserId(tech.id);
    setTechnicianName(tech.name);
    setTechnicianMenuOpen(false);
  };

  const clearTechnicianSelection = (value = '') => {
    setSelectedTechnician(null);
    setTechnicianUserId(null);
    setTechnicianName(value);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // Ensure we aren't using stale cached user data when entering this page.
        let u = user;
        if (!refreshedOnce.current) {
          refreshedOnce.current = true;
          try {
            const updated = await refreshUserData?.();
            if (updated) u = updated;
          } catch (err) {
            // Non-fatal: fall back to existing user data.
            console.warn('ReportUpload: refreshUserData failed:', err);
          }
        }

        const lvl = Math.max(
          Number(u?.highest_level ?? 0),
          Math.max(...((u?.roles || []).map(r => r.level || 0)), 0),
        );
        const allowed = !!(u?.is_superuser || lvl >= 90);
        if (!allowed) {
          navigate('/dashboard', { replace: true });
          return;
        }

        const resp = await api.get('/api/v1/companies/');
        if (cancelled) return;

        setCompanies(resp.data || []);

        if (!prefillApplied.current) {
          prefillApplied.current = true;

          if (prefillProjectId) {
            const projectResp = await api.get(`/api/v1/projects/${prefillProjectId}`);
            if (cancelled) return;

            const project = projectResp.data;
            if (project?.company_id) {
              pendingProjectId.current = String(project.id);
              setSelectedCompanyId(String(project.company_id));
            }
          } else if (prefillCompanyId) {
            setSelectedCompanyId(String(prefillCompanyId));
          }
        }
      } catch (err) {
        console.error('Failed to fetch companies:', err);
        if (!cancelled) setError('Failed to load companies');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [navigate, prefillCompanyId, prefillProjectId, refreshUserData, user]);

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
      const nextProjectId = pendingProjectId.current;
      setSelectedProjectId('');
      setReportKind('');
      setProjects([]);

      try {
        const resp = await api.get(`/api/v1/companies/${selectedCompanyId}/projects`);
        const loadedProjects = resp.data.projects || [];
        setProjects(loadedProjects);

        if (nextProjectId && loadedProjects.some(p => String(p.id) === String(nextProjectId))) {
          setSelectedProjectId(String(nextProjectId));
          pendingProjectId.current = null;
        }
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
    setStreetNumber('');
    setLocationLabel('');
    setLocationOptions([]);
    setWorkerName('');
    setTechnicianName('');
    setTechnicianUserId(null);
    setSelectedTechnician(null);
    setTechnicianMenuOpen(false);
    setNotes('');
    setFile(null);
  }, [selectedProjectId, reportKind]);

  useEffect(() => {
    if (hasStreetNumber(normalizeReportAddress(address))) {
      setStreetNumber('');
    }
  }, [address]);

  useEffect(() => {
    const loadTechnicians = async () => {
      if (!selectedProjectId) {
        setTechnicianSuggestions([]);
        return;
      }

      try {
        const [assignedResp, employeesResp] = await Promise.all([
          api.get(`/api/v1/projects/${selectedProjectId}/technicians`),
          api.get('/api/v1/users/employees'),
        ]);

        const assigned = assignedResp.data || [];
        const employees = employeesResp.data || [];
        const assignedIds = new Set(assigned.map((t) => String(t.id)));
        const byId = new Map();

        assigned.forEach((t) => {
          byId.set(String(t.id), {
            id: t.id,
            name: formatPersonName(t.first_name, t.last_name),
            email: t.email || '',
            assigned: true,
          });
        });

        employees.forEach((t) => {
          if (!byId.has(String(t.id))) {
            byId.set(String(t.id), {
              id: t.id,
              name: formatPersonName(t.first_name, t.last_name),
              email: t.email || '',
              assigned: assignedIds.has(String(t.id)),
            });
          }
        });

        const merged = [...byId.values()]
          .filter((t) => t.name)
          .sort((a, b) => {
            if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
            return a.name.localeCompare(b.name);
          });

        setTechnicianSuggestions(merged);
      } catch (err) {
        // Non-fatal: technician selection can remain freeform.
        console.warn('Failed to load technicians:', err);
        setTechnicianSuggestions([]);
      }
    };

    loadTechnicians();
  }, [selectedProjectId]);

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

    const formattedAddress = normalizeReportAddress(address, streetNumber);

    if (!address?.google_place_id || !formattedAddress) {
      setError('Location is required (select an address from Google Places)');
      return;
    }

    if (!hasStreetNumber(formattedAddress)) {
      setError('Street number is required for this Google address.');
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

      let technicianIdToSubmit = technicianUserId;
      let technicianNameToSubmit = technicianName.trim();
      let technicianToAssign = selectedTechnician;

      if (!technicianToAssign && technicianNameToSubmit) {
        const exactMatch = technicianSuggestions.find(
          (t) => t.name.toLowerCase() === technicianNameToSubmit.toLowerCase()
        );
        if (exactMatch) {
          technicianToAssign = exactMatch;
          technicianIdToSubmit = exactMatch.id;
          technicianNameToSubmit = exactMatch.name;
        }
      }

      if (technicianToAssign && !technicianToAssign.assigned) {
        try {
          await api.post(`/api/v1/projects/${selectedProjectId}/technicians`, {
            user_id: technicianToAssign.id,
          });
          technicianToAssign = { ...technicianToAssign, assigned: true };
          setSelectedTechnician(technicianToAssign);
          setTechnicianSuggestions((prev) =>
            prev.map((t) => String(t.id) === String(technicianToAssign.id) ? { ...t, assigned: true } : t)
          );
        } catch (assignErr) {
          console.error('Technician assignment failed:', assignErr);
          setError('Failed to assign technician to this project');
          return;
        }
      }

      const data = new FormData();
      data.append('project_id', String(selectedProjectId));
      data.append('report_kind', reportKind);
      data.append('report_date', reportDate);
      data.append('formatted_address', formattedAddress);
      data.append('google_place_id', address.google_place_id);
      if (address.latitude != null) data.append('latitude', String(address.latitude));
      if (address.longitude != null) data.append('longitude', String(address.longitude));
      if (locationLabel.trim()) data.append('location_label', locationLabel.trim());
      if (reportKind === 'personal') data.append('worker_name', workerName.trim());
      if (technicianNameToSubmit) data.append('technician_name', technicianNameToSubmit);
      if (technicianIdToSubmit != null) data.append('technician_user_id', String(technicianIdToSubmit));
      if (notes.trim()) data.append('notes', notes.trim());
      data.append('file', file);

      await api.post('/api/v1/reports/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess('Report uploaded successfully');
      // Keep the selections but clear form content so the user can upload another.
      setReportDate('');
      setAddress({});
      setStreetNumber('');
      setLocationLabel('');
      setWorkerName('');
      setTechnicianName('');
      setTechnicianUserId(null);
      setSelectedTechnician(null);
      setTechnicianMenuOpen(false);
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
            <option value="">Select A Company...</option>
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
              <option value="">Select A Project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedProject && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {selectedProject.status ? `Status: ${toTitleCase(selectedProject.status)}` : null}
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
              <option value="">Select A Type...</option>
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

              <div>
                <label htmlFor="report-technician" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Technician</label>
                <div className="relative">
                  <input
                    id="report-technician"
                    type="text"
                    role="combobox"
                    aria-expanded={technicianMenuOpen}
                    aria-controls="report-technician-options"
                    aria-autocomplete="list"
                    value={technicianName}
                    onFocus={() => setTechnicianMenuOpen(true)}
                    onChange={(e) => {
                      clearTechnicianSelection(e.target.value);
                      setTechnicianMenuOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setTechnicianMenuOpen(false);
                      }
                      if (e.key === 'Enter' && technicianMenuOpen && filteredTechnicians.length > 0) {
                        e.preventDefault();
                        chooseTechnician(filteredTechnicians[0]);
                      }
                    }}
                    onBlur={() => window.setTimeout(() => setTechnicianMenuOpen(false), 120)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Select Or Type Technician..."
                  />
                  {technicianMenuOpen && (
                    <div
                      id="report-technician-options"
                      role="listbox"
                      className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg"
                    >
                      {filteredTechnicians.length > 0 ? (
                        filteredTechnicians.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            role="option"
                            aria-selected={String(t.id) === String(technicianUserId)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => chooseTechnician(t)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-800 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-gray-700"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{t.name}</span>
                              {t.email ? <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{t.email}</span> : null}
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${t.assigned ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                              {t.assigned ? 'Assigned' : 'Employee'}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          Use Typed Technician Name
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <AddressInput
                value={address}
                onChange={setAddress}
                required
                showLocationName={false}
                allowManualEntry={false}
              />
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pick the address from Google Places (manual entry will not work for uploads).
              </div>
              {address?.google_place_id && !hasStreetNumber(normalizeReportAddress(address)) && (
                <div className="mt-3">
                  <label htmlFor="report-street-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Street Number
                  </label>
                  <input
                    id="report-street-number"
                    type="text"
                    inputMode="numeric"
                    value={streetNumber}
                    onChange={(e) => setStreetNumber(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter street number"
                  />
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Google returned the street name without the number. Enter the number shown in the suggestion.
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location (optional)</label>
              <input
                type="text"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                list="report-location-options"
                className="mt-1 block w-full px-3 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
              <div className="block text-sm font-medium text-gray-700 dark:text-gray-300">PDF File</div>
              <label
                htmlFor="report-pdf-file"
                className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-6 py-8 text-center transition hover:border-blue-500 hover:bg-blue-100 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:border-blue-700 dark:bg-blue-950/30 dark:hover:bg-blue-900/40"
              >
                <span className="sr-only">PDF File</span>
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-200">
                  {file ? file.name : 'Choose PDF'}
                </span>
                <span className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                  Click To Select A Report PDF
                </span>
              </label>
              <input
                id="report-pdf-file"
                type="file"
                aria-label="PDF File"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
