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

  useEffect(() => {
    // Redirect non-admins
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchCompanies();
  }, [isAdmin, navigate]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Company Management</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create New Company
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {companies.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No companies created yet
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Create your first company to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200 relative"
              onClick={() => navigate(`/companies/${company.id}`)}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Company Modal */}
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

    </div>
  );
};

export default CompanyManagement;