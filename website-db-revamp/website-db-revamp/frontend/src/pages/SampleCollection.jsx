import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import AddressInput from '../components/AddressInput';
import CameraScanner from '../components/CameraScanner';
import { formatDate, formatPSTTime } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

export default function SampleCollection() {
  const { projectId, addressId } = useParams();
  const { user } = useAuth();
  const visitId = addressId; // For backward compatibility
  
  // Determine if we're showing project-level or visit-level view
  const isProjectView = !addressId;
  
  const [project, setProject] = useState(null);
  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [samples, setSamples] = useState([]);
  const [blankSamples, setBlankSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Sample modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSampleDesc, setNewSampleDesc] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [detailsModalSample, setDetailsModalSample] = useState(null);
  const [newSampleBarcode, setNewSampleBarcode] = useState('');
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  
  // New visit modal state
  const [isNewVisitModalOpen, setIsNewVisitModalOpen] = useState(false);
  const [newVisitData, setNewVisitData] = useState({
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
  const [visitLoading, setVisitLoading] = useState(false);
  const [visitError, setVisitError] = useState(null);
  
  const [notification, setNotification] = useState(null);
  const [timers, setTimers] = useState({});

  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (isProjectView) {
      fetchProjectAndVisits();
    } else {
      fetchVisitAndSamples();
    }
  }, [projectId, visitId, isProjectView]);

  const fetchProjectAndVisits = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get project details
      const projectRes = await api.get(`/api/v1/projects/${projectId}`);
      setProject(projectRes.data);
      
      // Get all visits for the project
      const visitsRes = await api.get(`/api/v1/projects/${projectId}/visits`);
      setVisits(visitsRes.data);
    } catch (err) {
      setError('Failed to load project or visits');
      console.error('Error fetching project and visits:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitAndSamples = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get visits for the project and find the specific visit
      const visitsRes = await api.get(`/api/v1/projects/${projectId}/visits`);
      const foundVisit = visitsRes.data.find(v => v.id === parseInt(visitId));
      
      if (!foundVisit) {
        throw new Error('Visit not found');
      }
      
      setSelectedVisit(foundVisit);
      
      // Get samples for this visit
      const samplesRes = await api.get(`/api/v1/samples/visit/${visitId}?date=${today}`);
      
      // Separate regular samples from blank samples
      const regularSamples = samplesRes.data.filter(s => s.sample_type === 'regular');
      const blanks = samplesRes.data.filter(s => s.sample_type === 'lab_blank' || s.sample_type === 'field_blank');
      
      setSamples(regularSamples);
      setBlankSamples(blanks);
    } catch (err) {
      setError('Failed to load visit or samples');
      console.error('Error fetching visit and samples:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewVisit = async (e) => {
    e.preventDefault();
    setVisitLoading(true);
    setVisitError(null);
    try {
      // Helper function to convert country name to ISO code
      const getCountryCode = (countryName) => {
        if (!countryName) return null;
        const countryMap = {
          "United States": "US",
          "Canada": "CA",
          "Mexico": "MX",
          "United Kingdom": "GB",
          "Australia": "AU",
          "Germany": "DE",
          "France": "FR",
          "Japan": "JP",
          "China": "CN",
          "India": "IN",
          "Brazil": "BR"
        };
        return countryMap[countryName] || countryName.substring(0, 2);
      };

      // Prepare data for project visit with embedded address
      const visitData = {
        project_id: parseInt(projectId),
        visit_date: today,
        technician_id: user.id,
        notes: "New visit for sample collection",
        description: newVisitData.name,
        // Clean address data
        address_line1: newVisitData.address_line1,
        address_line2: newVisitData.address_line2,
        city: newVisitData.city,
        state: newVisitData.state,
        zip: newVisitData.zip,
        formatted_address: newVisitData.formatted_address,
        google_place_id: newVisitData.google_place_id || newVisitData.place_id,
        latitude: newVisitData.latitude,
        longitude: newVisitData.longitude,
        country: getCountryCode(newVisitData.country),
        // Optional Google Places enhanced fields
        postal_code: newVisitData.postal_code || newVisitData.zip,
        administrative_area_level_1: newVisitData.administrative_area_level_1 || newVisitData.state,
        locality: newVisitData.locality || newVisitData.city
      };
      
      const response = await api.post(`/api/v1/projects/${projectId}/addresses`, visitData);
      
      // Reset form
      setNewVisitData({
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
      
      setIsNewVisitModalOpen(false);
      
      // Navigate to the new visit's sample collection page
      const visitId = response.data.visit.id;
      navigate(`/projects/${projectId}/addresses/${visitId}/collect-samples`);
      
    } catch (err) {
      console.error('Error adding visit:', err);
      let errorMessage = "Failed to add visit";
      
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map(error => error.msg).join(', ');
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else {
          errorMessage = "Validation failed";
        }
      } else if (err.response?.status === 422) {
        errorMessage = "Invalid data provided. Please check your input.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setVisitError(errorMessage);
    } finally {
      setVisitLoading(false);
    }
  };

  const handleAddSample = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    try {
      await api.post('/api/v1/samples/', {
        project_id: parseInt(projectId, 10),
        visit_id: parseInt(visitId, 10),
        description: newSampleDesc,
        cassette_barcode: newSampleBarcode,
        flow_rate: 12,
        volume_required: 1000,
      });
      setNewSampleDesc('');
      setNewSampleBarcode('');
      setBarcodeScanned(false);
      setIsAddModalOpen(false);
      fetchVisitAndSamples();
    } catch (err) {
      setAddError('Failed to add sample');
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenDetailsModal = (sample) => setDetailsModalSample(sample);
  const handleCloseDetailsModal = () => setDetailsModalSample(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // State for barcode scanning
  const [scanningBlank, setScanningBlank] = useState(null); // { id, type } when scanning
  const [scannedBarcode, setScannedBarcode] = useState('');
  
  // State for camera scanning
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [currentScanContext, setCurrentScanContext] = useState(null); // { type: 'sample' | 'lab_blank' | 'field_blank', callback: function }
  
  // Listen for barcode scans when in scanning mode
  useEffect(() => {
    if (!scanningBlank) return;
    
    let buffer = '';
    let timeout = null;
    
    const handleKeyPress = (e) => {
      // Clear timeout on each keypress
      if (timeout) clearTimeout(timeout);
      
      // If Enter key, process the scanned barcode
      if (e.key === 'Enter') {
        e.preventDefault();
        if (buffer.trim()) {
          processScannedBarcode(buffer.trim());
          buffer = '';
        }
        return;
      }
      
      // If Escape key, cancel scanning
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelBarcodeScanning();
        return;
      }
      
      // Add character to buffer
      buffer += e.key;
      
      // Set timeout to process barcode if no more input
      timeout = setTimeout(() => {
        if (buffer.trim()) {
          processScannedBarcode(buffer.trim());
          buffer = '';
        }
      }, 100); // 100ms delay for barcode scanner input
    };
    
    document.addEventListener('keypress', handleKeyPress);
    return () => {
      document.removeEventListener('keypress', handleKeyPress);
      if (timeout) clearTimeout(timeout);
    };
  }, [scanningBlank]);
  
  const handleScanBlankBarcode = (sampleId, sampleType) => {
    // For new workflow, sampleId will be null since we're creating the sample on scan
    setScanningBlank({ id: sampleId, type: sampleType });
    setScannedBarcode('');
    showNotification(`Ready to scan ${sampleType === 'lab_blank' ? 'Lab' : 'Field'} blank barcode. Press Escape to cancel.`, 'success');
  };
  
  const processScannedBarcode = async (barcode) => {
    if (!scanningBlank) return;
    
    try {
      // Create new blank sample with the scanned barcode
      const newSample = await api.post('/api/v1/samples/', {
        project_id: parseInt(projectId),
        visit_id: parseInt(visitId),
        description: scanningBlank.type === 'lab_blank' ? 'Lab Blank' : 'Field Blank',
        cassette_barcode: barcode,
        sample_type: scanningBlank.type,
        flow_rate: null, // Blanks don't have flow rate
        volume_required: null // Blanks don't have volume requirements
      });
      
      // Add the new blank sample to the list
      setBlankSamples(prev => [...prev, newSample.data]);
      
      showNotification(`${scanningBlank.type === 'lab_blank' ? 'Lab' : 'Field'} blank created with barcode: ${barcode}`, 'success');
      setScanningBlank(null);
    } catch (err) {
      console.error('Error creating blank sample:', err);
      showNotification('Failed to create blank sample', 'error');
      setScanningBlank(null);
    }
  };
  
  const cancelBarcodeScanning = () => {
    setScanningBlank(null);
    setScannedBarcode('');
    showNotification('Barcode scanning cancelled', 'info');
  };

  // Camera scanning functions
  const openCameraScanner = (scanType, callback) => {
    setCurrentScanContext({ type: scanType, callback });
    setIsCameraScannerOpen(true);
  };

  const closeCameraScanner = () => {
    setIsCameraScannerOpen(false);
    setCurrentScanContext(null);
  };

  const handleCameraScan = async (scannedCode) => {
    console.log('Camera scanned:', scannedCode);
    
    try {
      // Validate the scanned barcode with the backend
      const validationResponse = await api.post('/api/v1/barcode/validate', {
        barcode: scannedCode,
        sample_type: currentScanContext?.type || 'regular',
        project_id: parseInt(projectId),
        visit_id: parseInt(visitId)
      });
      
      const { is_valid, formatted_barcode, validation_messages, is_duplicate } = validationResponse.data;
      
      if (!is_valid) {
        let errorMsg = 'Invalid barcode';
        if (validation_messages.length > 0) {
          errorMsg = validation_messages[0];
        }
        if (is_duplicate) {
          errorMsg = 'This barcode has already been used';
        }
        showNotification(errorMsg, 'error');
        return; // Don't close scanner, allow retry
      }
      
      // Show success message if barcode was reformatted
      if (validation_messages.length > 0) {
        validation_messages.forEach(msg => {
          if (msg.includes('formatted')) {
            showNotification(msg, 'info');
          }
        });
      }
      
      // Call the callback with the validated/formatted barcode
      if (currentScanContext?.callback) {
        currentScanContext.callback(formatted_barcode);
      }
      
      // Close the scanner
      closeCameraScanner();
      showNotification('Barcode scanned successfully!', 'success');
      
    } catch (err) {
      console.error('Error validating barcode:', err);
      let errorMsg = 'Failed to validate barcode';
      if (err.response?.data?.detail) {
        errorMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : 'Validation failed';
      }
      showNotification(errorMsg, 'error');
      // Don't close scanner, allow retry
    }
  };

  // Helper: format timer duration
  const formatTimer = (t) => {
    const h = Math.floor(t / 3600).toString().padStart(2, '0');
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Timer effect for all running samples
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev };
        for (const id in updated) {
          if (updated[id].running && updated[id].start && !updated[id].stop) {
            updated[id].elapsed = Math.floor((Date.now() - new Date(updated[id].start)) / 1000);
          }
        }
        return { ...updated };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync timers with samples on fetch
  useEffect(() => {
    const newTimers = {};
    samples.forEach(sample => {
      if (sample.start_time) {
        const running = sample.start_time && !sample.stop_time;
        let elapsed = 0;
        if (sample.start_time && sample.stop_time) {
          elapsed = Math.floor((new Date(sample.stop_time) - new Date(sample.start_time)) / 1000);
        } else if (sample.start_time && !sample.stop_time) {
          elapsed = Math.floor((Date.now() - new Date(sample.start_time)) / 1000);
        }
        newTimers[sample.id] = {
          running,
          start: sample.start_time,
          stop: sample.stop_time || null,
          elapsed,
        };
      }
    });
    setTimers(newTimers);
  }, [samples]);

  // Handler to update timer state from modal
  const handleTimerUpdate = (sampleId, timerState) => {
    setTimers(prev => ({ ...prev, [sampleId]: timerState }));
  };

  // Optimistic update handler
  const updateSampleOptimistically = (sampleId, updates) => {
    setSamples(prevSamples => prevSamples.map(s => s.id === sampleId ? { ...s, ...updates } : s));
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
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>
      </div>
    );
  }

  if (isProjectView) {
    // Project-level view: Show all visits for the project
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Project
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Sample Collection - {project?.name}
          </h1>
          <button
            onClick={() => setIsNewVisitModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            New Visit
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Project Visits</h2>
          {visits.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No visits found for this project.
              </p>
              <button
                onClick={() => setIsNewVisitModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create First Visit
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visits.map((visit) => (
                <div
                  key={visit.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                  onClick={() => navigate(`/projects/${projectId}/addresses/${visit.id}/collect-samples`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {visit.description || 'Visit Location'}
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(visit.visit_date)}
                    </span>
                  </div>
                  {visit.formatted_address && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {visit.formatted_address}
                    </p>
                  )}
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Technician: {visit.technician_name}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium">
                      Collect Samples →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* New Visit Modal */}
        <Modal isOpen={isNewVisitModalOpen} onClose={() => setIsNewVisitModalOpen(false)}>
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Add New Visit</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Add a new location where you'll be collecting samples for this project.
            </p>
            
            <form onSubmit={handleAddNewVisit}>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">Location Details</h3>
              
              <AddressInput
                value={newVisitData}
                onChange={setNewVisitData}
                required={true}
                disabled={visitLoading}
                className="mb-4"
              />
              
              {visitError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {visitError}
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsNewVisitModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={visitLoading || (!newVisitData.address_line1 && !newVisitData.formatted_address && !newVisitData.name)}
                >
                  {visitLoading ? 'Creating Visit...' : 'Create Visit & Start Collecting'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      </div>
    );
  }

  // Visit-level view: Show samples for a specific visit
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <button
          onClick={() => navigate(`/projects/${projectId}/collect-samples`)}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Project Visits
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Sample Collection
        </h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add Sample
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
          <div className="text-lg font-semibold text-gray-800 dark:text-white">
            {selectedVisit?.description || selectedVisit?.formatted_address || 'Collection Location'}
          </div>
          <div className="text-gray-500 dark:text-gray-400">{formatDate(selectedVisit?.visit_date)}</div>
        </div>
        {selectedVisit?.formatted_address && (
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {selectedVisit.formatted_address}
          </div>
        )}
        <div className="overflow-x-auto rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-900 dark:text-white">description</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-900 dark:text-white">start</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-900 dark:text-white">end</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-900 dark:text-white">Total Time</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-900 dark:text-white">details</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {samples.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">No samples for today.</td>
                </tr>
              ) : (
                samples.map(sample => {
                  let totalSeconds = 0;
                  if (sample.start_time && sample.stop_time) {
                    totalSeconds = Math.floor((new Date(sample.stop_time) - new Date(sample.start_time)) / 1000);
                  } else if (sample.start_time && !sample.stop_time) {
                    totalSeconds = Math.floor((Date.now() - new Date(sample.start_time)) / 1000);
                  }
                  return (
                    <tr key={sample.id}>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{sample.description}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{formatPSTTime(sample.start_time)}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{formatPSTTime(sample.stop_time)}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">
                        <span className={sample.start_time && !sample.stop_time ? "font-mono text-green-600 dark:text-green-400" : "font-mono"}>
                          {formatTimer(totalSeconds)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          onClick={() => handleOpenDetailsModal(sample)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Blank Samples Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Blank Samples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lab Blank */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Lab Blank
              </h3>
              {(() => {
                const labBlank = blankSamples.find(b => b.sample_type === 'lab_blank');
                return (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    !labBlank 
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {!labBlank ? 'Not Scanned' : 'Scanned'}
                  </span>
                );
              })()}
            </div>
            
            {(() => {
              const labBlank = blankSamples.find(b => b.sample_type === 'lab_blank');
              return labBlank && (
                <div className="mb-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Barcode: </span>
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    {labBlank.cassette_barcode}
                  </span>
                </div>
              );
            })()}
            
            <div className="flex justify-end">
              {(() => {
                const labBlank = blankSamples.find(b => b.sample_type === 'lab_blank');
                const isScanning = scanningBlank && scanningBlank.type === 'lab_blank';
                
                if (!labBlank) {
                  return (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          const callback = async (barcode) => {
                            try {
                              const newSample = await api.post('/api/v1/samples/', {
                                project_id: parseInt(projectId),
                                visit_id: parseInt(visitId),
                                description: 'Lab Blank',
                                cassette_barcode: barcode,
                                sample_type: 'lab_blank',
                                flow_rate: null,
                                volume_required: null
                              });
                              setBlankSamples(prev => [...prev, newSample.data]);
                            } catch (err) {
                              console.error('Error creating lab blank sample:', err);
                              showNotification('Failed to create lab blank sample', 'error');
                            }
                          };
                          openCameraScanner('lab_blank', callback);
                        }}
                        disabled={!!scanningBlank || isCameraScannerOpen}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        📷 Scan Lab Blank
                      </button>
                    </div>
                  );
                } else {
                  return (
                    <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                      ✓ Complete
                    </span>
                  );
                }
              })()}
            </div>
          </div>

          {/* Field Blank */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Field Blank
              </h3>
              {(() => {
                const fieldBlank = blankSamples.find(b => b.sample_type === 'field_blank');
                return (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    !fieldBlank 
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {!fieldBlank ? 'Not Scanned' : 'Scanned'}
                  </span>
                );
              })()}
            </div>
            
            {(() => {
              const fieldBlank = blankSamples.find(b => b.sample_type === 'field_blank');
              return fieldBlank && (
                <div className="mb-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Barcode: </span>
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    {fieldBlank.cassette_barcode}
                  </span>
                </div>
              );
            })()}
            
            <div className="flex justify-end">
              {(() => {
                const fieldBlank = blankSamples.find(b => b.sample_type === 'field_blank');
                const isScanning = scanningBlank && scanningBlank.type === 'field_blank';
                
                if (!fieldBlank) {
                  return (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          const callback = async (barcode) => {
                            try {
                              const newSample = await api.post('/api/v1/samples/', {
                                project_id: parseInt(projectId),
                                visit_id: parseInt(visitId),
                                description: 'Field Blank',
                                cassette_barcode: barcode,
                                sample_type: 'field_blank',
                                flow_rate: null,
                                volume_required: null
                              });
                              setBlankSamples(prev => [...prev, newSample.data]);
                            } catch (err) {
                              console.error('Error creating field blank sample:', err);
                              showNotification('Failed to create field blank sample', 'error');
                            }
                          };
                          openCameraScanner('field_blank', callback);
                        }}
                        disabled={!!scanningBlank || isCameraScannerOpen}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        📷 Scan Field Blank
                      </button>
                    </div>
                  );
                } else {
                  return (
                    <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                      ✓ Complete
                    </span>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      </div>
      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setBarcodeScanned(false); }}>
        <form onSubmit={handleAddSample} className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Sample</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
            <input
              type="text"
              value={newSampleDesc}
              onChange={e => setNewSampleDesc(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white px-4 py-2"
              placeholder="Enter sample description"
              required
              disabled={!barcodeScanned}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cassette Barcode</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newSampleBarcode}
                readOnly
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white px-4 py-2"
                placeholder="Scan barcode to fill"
                required
              />
              <button
                type="button"
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={() => {
                  const callback = (barcode) => {
                    setNewSampleBarcode(barcode);
                    setBarcodeScanned(true);
                  };
                  openCameraScanner('regular', callback);
                }}
                disabled={barcodeScanned || isCameraScannerOpen}
              >
                {barcodeScanned ? 'Scanned' : '📷 Scan Barcode'}
              </button>
            </div>
          </div>
          {addError && <div className="text-red-500">{addError}</div>}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => { setIsAddModalOpen(false); setBarcodeScanned(false); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={addLoading || !barcodeScanned}
            >
              Add Sample
            </button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={!!detailsModalSample} onClose={() => setDetailsModalSample(null)}>
        {detailsModalSample && (
          <DetailsModalContent
            sample={detailsModalSample}
            onClose={() => setDetailsModalSample(null)}
            onUpdate={fetchAddressAndSamples}
            showNotification={showNotification}
            timerState={timers[detailsModalSample.id]}
            onTimerUpdate={state => handleTimerUpdate(detailsModalSample.id, state)}
            formatPSTTime={formatPSTTime}
            formatTimer={formatTimer}
            updateSampleOptimistically={updateSampleOptimistically}
            openCameraScanner={openCameraScanner}
          />
        )}
      </Modal>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 
          notification.type === 'info' ? 'bg-blue-600 text-white' :
          'bg-red-600 text-white'
        }`}>{notification.msg}</div>
      )}
      
      {/* Scanning Mode Overlay */}
      {scanningBlank && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Scanning {scanningBlank.type === 'lab_blank' ? 'Lab' : 'Field'} Blank
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Point your barcode scanner at the cassette barcode and scan now.
                </p>
              </div>
              
              <div className="flex justify-center space-x-3">
                <button
                  onClick={cancelBarcodeScanning}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Cancel Scanning
                </button>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                You can also press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Escape</kbd> to cancel
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Camera Scanner */}
      <CameraScanner
        isOpen={isCameraScannerOpen}
        onScan={handleCameraScan}
        onClose={closeCameraScanner}
        title={`Scan ${currentScanContext?.type === 'lab_blank' ? 'Lab Blank' : currentScanContext?.type === 'field_blank' ? 'Field Blank' : 'Sample'} Barcode`}
        description="Point your camera at the barcode or QR code on the cassette to scan it."
      />
    </div>
  );
};

function DetailsModalContent({ sample, onClose, onUpdate, showNotification, timerState, onTimerUpdate, formatPSTTime, formatTimer, updateSampleOptimistically, openCameraScanner }) {
  const [scanned, setScanned] = React.useState(!!sample.cassette_barcode);
  const [form, setForm] = React.useState({
    description: sample.description || '',
    is_inside: sample.is_inside ?? null,
    flow_rate: sample.flow_rate ?? 12,
    volume_required: sample.volume_required ?? 1000,
    cassette_barcode: sample.cassette_barcode || '',
    start_time: sample.start_time ? new Date(sample.start_time) : null,
    stop_time: sample.stop_time ? new Date(sample.stop_time) : null,
  });
  const [timer, setTimer] = React.useState(() => {
    if (sample.start_time && sample.stop_time) {
      return (new Date(sample.stop_time) - new Date(sample.start_time)) / 1000;
    } else if (sample.start_time && !sample.stop_time) {
      return (Date.now() - new Date(sample.start_time)) / 1000;
    }
    return 0;
  });
  const [timerRunning, setTimerRunning] = React.useState(!!(sample.start_time && !sample.stop_time));
  const [timerInterval, setTimerInterval] = React.useState(null);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const initialForm = useRef(form);
  const [submitting, setSubmitting] = React.useState(false);

  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      const interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  }, [timerRunning]);

  // Timer control handlers with immediate backend PATCH and optimistic UI
  const handleStart = async () => {
    if (!form.start_time) {
      const now = new Date();
      setForm(f => ({ ...f, start_time: now, stop_time: null }));
      setTimer(0);
      setTimerRunning(true);
      // PATCH start_time immediately
      try {
        await api.patch(`/api/v1/samples/${sample.id}`, {
          start_time: now.toISOString(),
          stop_time: null,
        });
        onTimerUpdate(sample.id, { running: true, start: now, stop: null, elapsed: 0 });
        updateSampleOptimistically(sample.id, { start_time: now.toISOString(), stop_time: null });
      } catch (err) {
        showNotification('Failed to start timer', 'error');
      }
    } else {
      setTimerRunning(true);
    }
  };

  const handleStop = async () => {
    if (form.start_time) {
      const now = new Date();
      setForm(f => ({ ...f, stop_time: now }));
      setTimerRunning(false);
      // PATCH stop_time immediately
      try {
        await api.patch(`/api/v1/samples/${sample.id}`, {
          stop_time: now.toISOString(),
        });
        onTimerUpdate(sample.id, { running: false, start: form.start_time, stop: now, elapsed: Math.floor((now - new Date(form.start_time)) / 1000) });
        updateSampleOptimistically(sample.id, { stop_time: now.toISOString() });
      } catch (err) {
        showNotification('Failed to stop timer', 'error');
      }
    }
  };

  const handleResume = async () => {
    if (form.start_time && form.stop_time) {
      setForm(f => ({ ...f, stop_time: null }));
      setTimerRunning(true);
      // PATCH only stop_time immediately
      try {
        await api.patch(`/api/v1/samples/${sample.id}`, {
          stop_time: null,
        });
        onTimerUpdate(sample.id, { running: true, start: form.start_time, stop: null, elapsed: Math.floor((Date.now() - new Date(form.start_time)) / 1000) });
        updateSampleOptimistically(sample.id, { stop_time: null });
      } catch (err) {
        showNotification('Failed to resume timer', 'error');
      }
    }
  };

  const confirmReset = async () => {
    setForm(f => ({ ...f, start_time: null, stop_time: null }));
    setTimer(0);
    setTimerRunning(false);
    setShowResetConfirm(false);
    // PATCH reset times immediately
    try {
      await api.patch(`/api/v1/samples/${sample.id}`, {
        start_time: null,
        stop_time: null,
      });
      onTimerUpdate(sample.id, { running: false, start: null, stop: null, elapsed: 0 });
      updateSampleOptimistically(sample.id, { start_time: null, stop_time: null });
    } catch (err) {
      showNotification('Failed to reset timer', 'error');
    }
  };

  const handleScan = () => {
    if (!form.cassette_barcode && openCameraScanner) {
      const callback = (barcode) => {
        setForm(f => ({ ...f, cassette_barcode: barcode }));
        setScanned(true);
      };
      openCameraScanner('regular', callback);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const isChanged = () => {
    const a = initialForm.current;
    const b = form;
    return (
      a.description !== b.description ||
      a.is_inside !== b.is_inside ||
      a.flow_rate !== b.flow_rate ||
      a.volume_required !== b.volume_required ||
      a.cassette_barcode !== b.cassette_barcode
    );
  };

  const handleClose = async () => {
    if (isChanged() && form.cassette_barcode) {
      setSubmitting(true);
      try {
        await api.patch(`/api/v1/samples/${sample.id}`, {
          description: form.description,
          is_inside: form.is_inside,
          flow_rate: Number(form.flow_rate),
          volume_required: Number(form.volume_required),
          cassette_barcode: form.cassette_barcode,
        });
        showNotification('Sample updated successfully', 'success');
        onUpdate && onUpdate();
      } catch (err) {
        showNotification('Failed to update sample', 'error');
      } finally {
        setSubmitting(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="space-y-6 text-gray-900 dark:text-white">
      <h2 className="text-2xl font-bold mb-2">Sample Details</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Cassette Barcode</label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={form.cassette_barcode}
            readOnly
            className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white"
            placeholder="Scan barcode to fill"
          />
          {!form.cassette_barcode && (
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={handleScan}
              disabled={!!form.cassette_barcode}
            >
              📷 Scan Barcode
            </button>
          )}
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Timer</label>
        <div className="flex items-center space-x-4">
          <div className="text-2xl font-mono">{formatTimer(timer)}</div>
          {!form.start_time && (
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={handleStart} disabled={!scanned}>Start</button>
          )}
          {form.start_time && !form.stop_time && timerRunning && (
            <button className="px-3 py-1 bg-yellow-600 text-white rounded" onClick={handleStop}>Stop</button>
          )}
          {form.start_time && form.stop_time && (
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleResume}>Resume</button>
          )}
          {(form.start_time || timer > 0) && (
            <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={() => setShowResetConfirm(true)}>Reset</button>
          )}
        </div>
        <div className="flex space-x-6 mt-2">
          <div>Start: <span className="font-mono">{formatPSTTime(form.start_time)}</span></div>
          <div>End: <span className="font-mono">{formatPSTTime(form.stop_time)}</span></div>
        </div>
      </div>
      {showResetConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg">
            <div className="mb-4 text-lg">Are you sure you want to reset the timer? This cannot be undone.</div>
            <div className="flex justify-end space-x-3">
              <button className="px-4 py-2 bg-gray-300 rounded" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={confirmReset}>Reset</button>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            name="description"
            value={form.description}
            onChange={handleChange}
            disabled={!scanned}
            className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">In/Out</label>
          <select
            name="is_inside"
            value={form.is_inside === null ? '' : form.is_inside ? 'inside' : 'outside'}
            onChange={e => setForm(f => ({ ...f, is_inside: e.target.value === 'inside' }))}
            disabled={!scanned}
            className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white"
          >
            <option value="">-- Select --</option>
            <option value="inside">Inside</option>
            <option value="outside">Outside</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Flow Rate (L/M)</label>
          <input
            type="number"
            name="flow_rate"
            value={form.flow_rate}
            onChange={handleChange}
            disabled={!scanned}
            className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Volume Required (Liters)</label>
          <input
            type="number"
            name="volume_required"
            value={form.volume_required}
            onChange={handleChange}
            disabled={!scanned}
            className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={submitting}
        >
          Close
        </button>
      </div>
    </div>
  );
} 