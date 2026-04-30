import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Modal from '../components/Modal';
import AddressInput from '../components/AddressInput';
import { formatCompanyName } from '../utils/textUtils';

const CompanyManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [companyData, setCompanyData] = useState({
    name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
    formatted_address: '',
    google_place_id: '',
    latitude: null,
    longitude: null
  });
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get the highest role level from user's roles
  const userRoleLevel = Math.max(...(user?.roles?.map(role => role.level) || [0]));
  const isAdmin = userRoleLevel >= 100; // Admin level is 100
  const isSupervisorOrHigher = userRoleLevel >= 80; // Supervisor level is 80

  useEffect(() => {
    // Redirect anyone below supervisor
    if (!isSupervisorOrHigher) {
      navigate('/dashboard');
      return;
    }
    fetchCompanies();
  }, [isSupervisorOrHigher, navigate]);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/api/v1/companies/');
      setCompanies(response.data);
    } catch (err) {
      setError('Failed to fetch companies');
      console.error('Error fetching companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCompanyData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddressChange = (addressData) => {
    // Filter out 'name' field to prevent overwriting company name with place name
    const { name, ...addressFields } = addressData;
    
    setCompanyData(prev => ({
      ...prev,
      ...addressFields
    }));
  };

  const resetForm = () => {
    setCompanyData({
      name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip: '',
      formatted_address: '',
      google_place_id: '',
      latitude: null,
      longitude: null
    });
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/v1/companies/', companyData);
      await fetchCompanies();
      setIsCreateModalOpen(false);
      resetForm();
    } catch (err) {
      setError('Failed to create company');
      console.error('Error creating company:', err);
    }
  };


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const filteredCompanies = companies.filter(company => {
    if (!searchTerm.trim()) return true;

    const search = searchTerm.toLowerCase();

    const name = (company.name || '').toLowerCase();
    const primaryContact = (company.primary_contact_name || '').toLowerCase();

    // Future-friendly: keep these fields in the search surface if/when the backend
    // starts returning client names.
    const clientCount = String(company.client_count ?? '').toLowerCase();

    return (
      name.includes(search) ||
      primaryContact.includes(search) ||
      clientCount.includes(search)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Companies</h1>
        {isAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create New Company
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
            placeholder="Search companies (name / primary contact / client count)..."
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

      {filteredCompanies.length === 0 && companies.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No companies created yet
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {isAdmin ? 'Create your first company to get started' : 'Ask an admin to create a company to get started'}
          </p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No companies match your search
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Try adjusting your search terms
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200 relative"
              onClick={() => {
                if (isAdmin) {
                  navigate(`/companies/${company.id}`);
                } else {
                  navigate(`/companies/${company.id}/reports`);
                }
              }}
            >
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {formatCompanyName(company.name)}
                </h3>
                {(company.address_line1 || company.city || company.state) && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                    {[company.address_line1, company.city, company.state, company.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Created: {formatDate(company.created_at)}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Projects</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{company.total_projects ?? 0}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Open</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{company.open_projects ?? 0}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Clients</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{company.client_count ?? 0}</div>
                  </div>
                </div>

                {company.primary_contact_name && (
                  <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Primary Contact:</span> {company.primary_contact_name}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/companies/${company.id}/reports`);
                    }}
                    className="px-3 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    View Reports
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Company Modal */}
      {isAdmin && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            resetForm();
          }}
          title="Create New Company"
        >
        <form onSubmit={handleCreateCompany} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Company Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={companyData.name}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white px-4 py-2"
              required
            />
          </div>

          <AddressInput
            value={{
              name: '',
              address_line1: companyData.address_line1,
              address_line2: companyData.address_line2,
              city: companyData.city,
              state: companyData.state,
              zip: companyData.zip,
              formatted_address: companyData.formatted_address,
              google_place_id: companyData.google_place_id,
              latitude: companyData.latitude,
              longitude: companyData.longitude
            }}
            onChange={handleAddressChange}
            required={false}
            showManualEntry={false}
            showLocationName={false}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create Company
            </button>
          </div>
        </form>
        </Modal>
      )}

    </div>
  );
};

export default CompanyManagement;