import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const CompanyDashboard = () => {
  const [company, setCompany] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  const userRoleLevel = Math.max(...(user?.roles?.map(role => role.level) || [0]));
  const hasClientRole = user?.roles?.some(role => role.name.toLowerCase() === 'client');
  const isAdmin = userRoleLevel >= 100;
  const isClient = hasClientRole && user?.company_id && !isAdmin;

  useEffect(() => {
    if (!isClient) {
      navigate('/dashboard');
      return;
    }
    fetchCompanyData();
  }, [isClient, navigate]);

  const fetchCompanyData = async () => {
    try {
      const companyResponse = await api.get('/api/v1/companies/');
      if (companyResponse.data && companyResponse.data.length > 0) {
        const userCompany = companyResponse.data[0];
        setCompany(userCompany);

        const projectsResponse = await api.get(`/api/v1/companies/${userCompany.id}/projects`);
        setProjects(projectsResponse.data.projects || []);
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
                    onClick={() => navigate(`/projects/${project.id}/reports`)}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
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
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.id}/reports`);
                        }}
                        className="w-full px-3 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        View Reports
                      </button>
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
