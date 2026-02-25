import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const CompanyDashboard = () => {
  const [company, setCompany] = useState(null);
  const [projects, setProjects] = useState([]);
  const [reportsByProject, setReportsByProject] = useState({});
  const [downloadingReportId, setDownloadingReportId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get the highest role level from user's roles
  const userRoleLevel = Math.max(...(user?.roles?.map(role => role.level) || [0]));
  const hasClientRole = user?.roles?.some(role => role.name.toLowerCase() === 'client');
  const isAdmin = userRoleLevel >= 100; // Admin level is 100
  const isClient = hasClientRole && user?.company_id && !isAdmin; // Must have Client role, be assigned to a company, and NOT be admin

  useEffect(() => {
    // Redirect users who don't meet client requirements
    if (!isClient) {
      navigate('/dashboard');
      return;
    }
    fetchCompanyData();
  }, [isClient, navigate]);

  const fetchCompanyData = async () => {
    try {
      // Fetch company info - for clients, this will return their company
      const companyResponse = await api.get('/api/v1/companies/');
      if (companyResponse.data && companyResponse.data.length > 0) {
        const userCompany = companyResponse.data[0]; // For clients, backend returns only their company
        setCompany(userCompany);

        // Fetch projects for this company
        const projectsResponse = await api.get(`/api/v1/companies/${userCompany.id}/projects`);
        const companyProjects = projectsResponse.data.projects || [];
        setProjects(companyProjects);

        // Fetch client-visible, final reports for this company and group by project.
        const reportsResponse = await api.get('/api/v1/reports/client/reports');
        const reports = reportsResponse.data || [];
        const byProject = {};
        for (const r of reports) {
          const pid = r.project_id;
          if (!byProject[pid]) byProject[pid] = [];
          byProject[pid].push(r);
        }
        setReportsByProject(byProject);
      }
    } catch (err) {
      setError('Failed to fetch company data');
      console.error('Error fetching company data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const downloadReport = async (report) => {
    try {
      setDownloadingReportId(report.id);
      const response = await api.get(`/api/v1/reports/${report.id}/download`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const base = (report.report_name || `report_${report.id}`).replace(/[^a-z0-9 _.-]/gi, '_');
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

  const getStatusBadgeColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      case 'reopened':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {company ? (
        <>
          {/* Company Header */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {company.name}
                </h1>
                {(company.address_line1 || company.city || company.state) && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {[company.address_line1, company.address_line2, company.city, company.state, company.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Client since: {formatDate(company.created_at)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">{projects.length}</div>
                <div className="text-sm text-gray-500">Total Projects</div>
              </div>
            </div>
          </div>

          {/* Projects Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Your Projects</h2>
            
            {projects.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No projects yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Your projects with EnviroCentric will appear here once they are created.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {project.name}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    
                    {project.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                        {project.description}
                      </p>
                    )}

                    <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{formatDate(project.created_at)}</span>
                      </div>
                      {project.current_start_date && (
                        <div className="flex justify-between">
                          <span>Start Date:</span>
                          <span>{formatDate(project.current_start_date)}</span>
                        </div>
                      )}
                      {project.current_end_date && (
                        <div className="flex justify-between">
                          <span>End Date:</span>
                          <span>{formatDate(project.current_end_date)}</span>
                        </div>
                      )}
                      {project.visit_count !== undefined && (
                        <div className="flex justify-between">
                          <span>Site Visits:</span>
                          <span>{project.visit_count}</span>
                        </div>
                      )}
                      {project.sample_count !== undefined && (
                        <div className="flex justify-between">
                          <span>Samples:</span>
                          <span>{project.sample_count}</span>
                        </div>
                      )}
                    </div>

                    {/* Reports */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Reports</div>
                      {(reportsByProject[project.id] || []).length === 0 ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400">No reports available yet.</div>
                      ) : (
                        <ul className="space-y-2">
                          {(reportsByProject[project.id] || []).map((r) => (
                            <li key={r.id} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {r.report_kind ? `${String(r.report_kind).toUpperCase()} Report` : 'Report'}
                                  {r.worker_name ? ` - ${r.worker_name}` : ''}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {(r.report_date || r.generated_at) ? formatDate(r.report_date || r.generated_at) : ''}
                                  {r.formatted_address ? ` • ${r.formatted_address}` : ''}
                                  {r.location_label ? ` (${r.location_label})` : ''}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => downloadReport(r)}
                                disabled={downloadingReportId === r.id}
                                className="shrink-0 px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                {downloadingReportId === r.id ? 'Downloading...' : 'Download'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0h3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0v-5" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Company information not available
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Please contact your administrator to assign you to a company.
          </p>
        </div>
      )}
    </div>
  );
};

export default CompanyDashboard;