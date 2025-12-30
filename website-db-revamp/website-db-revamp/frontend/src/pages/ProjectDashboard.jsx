import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import { formatDate } from '../utils/dateUtils';
import { formatRoleName } from '../utils/roleUtils';
import { useAuth } from '../context/AuthContext';

export default function ProjectDashboard() {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [availableTechnicians, setAvailableTechnicians] = useState([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);
  const [assignedTechnicians, setAssignedTechnicians] = useState([]);
  const [technicianSearchTerm, setTechnicianSearchTerm] = useState('');
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get the highest role level from user's roles
  const userRoleLevel = Math.max(...(user?.roles?.map(role => role.level) || [0]));
  const isSupervisorOrHigher = userRoleLevel >= 80; // Supervisor level is 80
  const isManagerOrHigher = userRoleLevel >= 90; // Manager level is 90

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetchProjectDetails();
    if (isSupervisorOrHigher) {
      fetchTechnicians();
    }
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      const response = await api.get(`/api/v1/projects/${projectId}`);
      setProject(response.data);
      // Get assigned technicians
      const techResponse = await api.get(`/api/v1/projects/${projectId}/technicians`);
      setAssignedTechnicians(techResponse.data);
    } catch (err) {
      setError('Failed to fetch project details');
      console.error('Error fetching project details:', err);
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
      console.error('Error fetching technicians:', err);
    }
  };

  const handleAssignTechnicians = async () => {
    try {
      // Get currently assigned technician IDs
      const currentAssignedIds = assignedTechnicians.map(tech => tech.id);
      
      // Find technicians to add (selected but not currently assigned)
      const techniciansToAdd = selectedTechnicians.filter(id => !currentAssignedIds.includes(id));
      
      // Find technicians to remove (currently assigned but not selected)
      const techniciansToRemove = currentAssignedIds.filter(id => !selectedTechnicians.includes(id));
      
      // Add new technicians
      for (const techId of techniciansToAdd) {
        await api.post(`/api/v1/projects/${projectId}/technicians`, {
          user_id: techId
        });
      }
      
      // Remove unselected technicians
      for (const techId of techniciansToRemove) {
        await api.delete(`/api/v1/projects/${projectId}/technicians/${techId}`);
      }
      
      // Refresh project details to get updated technician list
      await fetchProjectDetails();
      setIsAssignModalOpen(false);
      setSelectedTechnicians([]);
      setTechnicianSearchTerm('');
    } catch (err) {
      setError('Failed to assign technicians');
      console.error('Error assigning technicians:', err);
    }
  };

  const handleUnassignTechnician = async (userId) => {
    try {
      await api.delete(`/api/v1/projects/${projectId}/technicians/${userId}`);
      // Refresh project details to get updated technician list
      await fetchProjectDetails();
    } catch (err) {
      setError('Failed to unassign technician');
      console.error('Error unassigning technician:', err);
    }
  };

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

  // Filter technicians based on search term
  const filteredTechnicians = availableTechnicians.filter(tech => {
    if (!technicianSearchTerm.trim()) return true;
    
    const fullName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
    const roles = (tech.roles && Array.isArray(tech.roles) ? tech.roles : []).map(role => role.name).join(' ');
    
    return smartSearch(fullName, technicianSearchTerm) || smartSearch(roles, technicianSearchTerm);
  });

  // Update selected technicians when modal opens
  useEffect(() => {
    if (isAssignModalOpen) {
      setSelectedTechnicians(assignedTechnicians.map(tech => tech.id));
      setTechnicianSearchTerm(''); // Clear search when opening modal
    }
  }, [isAssignModalOpen, assignedTechnicians]);

  const handleAction = (action) => {
    switch (action) {
      case 'collect':
        navigate(`/projects/${projectId}/collect-samples`);
        break;
      case 'analyze':
        console.log('Analyze samples functionality to be implemented');
        break;
      case 'reports':
        console.log('View reports functionality to be implemented');
        break;
      default:
        break;
    }
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Project not found
          </h2>
          <button
            onClick={() => navigate('/projects')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/projects')}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Projects
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {project.name}
            </h1>
            {project.company_name && project.company_id && (
              <div className="mb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">Company:</span>
                <button
                  onClick={() => navigate(`/companies/${project.company_id}`)}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline"
                >
                  {project.company_name}
                </button>
              </div>
            )}
            <p className="text-gray-500 dark:text-gray-400">
              Created: {formatDate(project.created_at)}
            </p>
          </div>
          {isSupervisorOrHigher && (
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isManagerOrHigher ? 'Manage Technicians' : 'View Technicians'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => handleAction('collect')}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200 text-left"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Collect Samples
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Add a collection location and start recording samples
          </p>
        </button>

        <button
          onClick={() => handleAction('analyze')}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200 text-left"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Analyze Samples
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Process and analyze collected samples
          </p>
        </button>

        <button
          onClick={() => handleAction('reports')}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200 text-left"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            View Reports
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Access and generate project reports
          </p>
        </button>
      </div>

      {project.addresses && project.addresses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Project Addresses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {project.addresses.map((address) => (
              <div
                key={address.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {address.name}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Date: {formatDate(address.date)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
      >
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isManagerOrHigher ? 'Manage Technicians' : 'View Assigned Technicians'}
          </h2>
          
          {isManagerOrHigher && (
            <div>
              <label htmlFor="technicianSearch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Technicians
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  id="technicianSearch"
                  type="text"
                  placeholder="Search by name or role..."
                  value={technicianSearchTerm}
                  onChange={(e) => setTechnicianSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {isManagerOrHigher ? 'Assign Technicians' : 'Assigned Technicians'}
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {(isManagerOrHigher ? filteredTechnicians : assignedTechnicians).map((tech) => (
                <div key={tech.id} className={`flex items-center p-3 rounded-lg border ${isManagerOrHigher ? 'border-gray-200 dark:border-gray-700' : 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'}`}>
                  {isManagerOrHigher && (
                    <input
                      type="checkbox"
                      checked={selectedTechnicians.includes(tech.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTechnicians([...selectedTechnicians, tech.id]);
                        } else {
                          setSelectedTechnicians(selectedTechnicians.filter(id => id !== tech.id));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {tech.first_name} {tech.last_name}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(tech.roles && Array.isArray(tech.roles) ? tech.roles : []).map((role) => (
                          <span
                            key={role.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                          >
                            {formatRoleName(role.name)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {tech.email && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tech.email}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(isManagerOrHigher ? filteredTechnicians : assignedTechnicians).length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                {isManagerOrHigher 
                  ? (technicianSearchTerm ? 'No technicians match your search.' : 'No employees available.')
                  : 'No technicians assigned to this project.'}
              </p>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isManagerOrHigher ? 'Cancel' : 'Close'}
            </button>
            {isManagerOrHigher && (
              <button
                type="button"
                onClick={handleAssignTechnicians}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save Changes
              </button>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
} 