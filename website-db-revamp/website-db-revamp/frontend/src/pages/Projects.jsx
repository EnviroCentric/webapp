import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRoles } from '../context/RolesContext';
import api from '../services/api';
import Modal from '../components/Modal';
import { formatDate } from '../utils/dateUtils';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [availableTechnicians, setAvailableTechnicians] = useState([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [technicianSearchTerm, setTechnicianSearchTerm] = useState('');
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const { user } = useAuth();
  const { roles } = useRoles();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the highest role level from user's roles
  const userRoleLevel = Math.max(...(user?.roles?.map(role => role.level) || [0]));
  const isSupervisorOrHigher = userRoleLevel >= 80; // Supervisor level is 80
  const isAdmin = userRoleLevel >= 100; // Admin level is 100

  useEffect(() => {
    // Redirect technicians to dashboard
    if (!isSupervisorOrHigher) {
      navigate('/dashboard');
      return;
    }
    fetchProjects();
    fetchTechnicians();
    
    // Fetch companies for admins
    if (isAdmin) {
      fetchCompanies();
      
      // Check if we have a pre-selected company from navigation state
      const preSelectedCompanyId = location.state?.selectedCompanyId;
      if (preSelectedCompanyId) {
        setSelectedCompanyId(preSelectedCompanyId.toString());
        // Auto-open the create modal if we came from a company details page
        setIsCreateModalOpen(true);
        // Clear the navigation state to prevent auto-opening again
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/api/v1/projects/');
      setProjects(response.data);
    } catch (err) {
      setError('Failed to fetch projects');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      // Get employees (users with field tech roles and higher - level >= 50)
      const response = await api.get('/api/v1/users/employees');
      setAvailableTechnicians(response.data);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      setCompaniesLoading(true);
      const response = await api.get('/api/v1/companies/');
      setAvailableCompanies(response.data);
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setCompaniesLoading(false);
    }
  };

  const capitalizeProjectName = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Filter projects based on search term
  const filteredProjects = projects.filter(project => {
    if (!searchTerm.trim()) return true;
    
    const projectName = project.name?.toLowerCase() || '';
    const companyName = project.company_name?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    
    return projectName.includes(search) || companyName.includes(search);
  });

  // Smart search function that matches individual letters from roles and name
  const smartSearch = (text, searchTerm) => {
    if (!searchTerm.trim()) return true;
    const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanSearch = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Regular substring match first
    if (cleanText.includes(cleanSearch)) return true;
    
    // Smart letter matching - check if all search letters exist in the text
    const searchChars = cleanSearch.split('');
    let textIndex = 0;
    
    for (const char of searchChars) {
      const found = cleanText.indexOf(char, textIndex);
      if (found === -1) return false;
      textIndex = found + 1;
    }
    return true;
  };

  // Filter employees based on search term for project modal (names only)
  const filteredTechnicians = availableTechnicians.filter(tech => {
    if (!technicianSearchTerm.trim()) return true;
    
    const fullName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
    
    return smartSearch(fullName, technicianSearchTerm);
  });


  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const capitalizedName = capitalizeProjectName(newProjectName);
      
      // Determine company_id based on user role
      let companyId;
      if (isAdmin) {
        if (!selectedCompanyId) {
          setError('Please select a company for this project');
          return;
        }
        companyId = parseInt(selectedCompanyId);
      } else {
        // Non-admin users use their own company
        if (!user.company_id) {
          setError('You must be assigned to a company to create projects');
          return;
        }
        companyId = user.company_id;
      }
      
      const response = await api.post('/api/v1/projects/', {
        name: capitalizedName,
        company_id: companyId
      });
      
      // Refresh the projects list to get the updated data
      await fetchProjects();
      
      setIsCreateModalOpen(false);
      setNewProjectName('');
      setSelectedCompanyId('');
      setSelectedTechnicians([]);
      setTechnicianSearchTerm('');
      setError(''); // Clear any previous errors
    } catch (err) {
      setError('Failed to create project');
      console.error('Error creating project:', err);
    }
  };

  const handleProjectClick = (projectId) => {
    navigate(`/projects/${projectId}`);
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
      {isSupervisorOrHigher && (
        <button
          onClick={() => {
            if (isAdmin && availableCompanies.length === 0 && !companiesLoading) {
              // Redirect to company creation if no companies exist
              if (window.confirm('No companies exist yet. Would you like to create a company first?')) {
                navigate('/companies');
                return;
              }
            }
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create New Project
        </button>
      )}
      </div>
      
      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search projects by name or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {filteredProjects.length === 0 && projects.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No projects currently assigned
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {isSupervisorOrHigher 
              ? "Create a new project to get started"
              : "You will be notified when projects are assigned to you"}
          </p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No projects match your search
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Try adjusting your search terms
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project.id)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {capitalizeProjectName(project.name)}
              </h3>
              {project.company_name && (
                <div className="mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {project.company_name}
                  </span>
                </div>
              )}
              <p className="text-gray-500 dark:text-gray-400">
                Created: {formatDate(project.created_at)}
              </p>
              {project.addresses && project.addresses.length > 0 && (
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  {project.addresses.length} address{project.addresses.length !== 1 ? 'es' : ''} assigned
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      >
        <form onSubmit={handleCreateProject} className="space-y-6">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              id="projectName"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white px-4 py-2"
              placeholder="Enter project name"
              required
            />
          </div>

          {/* Company Selection for Admins */}
          {isAdmin && (
            <div>
              <label htmlFor="companySelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Company *
              </label>
              {companiesLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading companies...</div>
              ) : availableCompanies.length === 0 ? (
                <div className="text-sm text-red-600 dark:text-red-400">
                  No companies available. 
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      navigate('/companies');
                    }}
                    className="text-blue-600 hover:text-blue-500 underline ml-1"
                  >
                    Create a company first
                  </button>
                </div>
              ) : (
                <select
                  id="companySelect"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white px-4 py-2"
                  required
                >
                  <option value="">Choose a company...</option>
                  {availableCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Info for non-admins */}
          {!isAdmin && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This project will be created for {user?.company_name || 'your company'}.
              </p>
            </div>
          )}

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You can assign employees and add addresses after creating the project.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewProjectName('');
                setSelectedCompanyId('');
                setSelectedTechnicians([]);
                setTechnicianSearchTerm('');
                setError('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create Project
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
} 