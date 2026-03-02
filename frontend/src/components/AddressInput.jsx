import React, { useEffect, useMemo, useRef, useState } from 'react';
import SimpleGooglePlaces from './SimpleGooglePlaces';
import { GoogleMapsLoader } from './GooglePlacesAutocomplete';

/**
 * Enhanced Address Input component with Google Places integration
 * Falls back to manual entry if Google Places is not available
 */
const AddressInput = ({ 
  value = {}, 
  onChange, 
  required = false, 
  disabled = false,
  showManualEntry = false,
  allowManualEntry = true,
  className = "",
  showLocationName = true // New prop to control location name visibility
}) => {
  const [manualMode, setManualMode] = useState(showManualEntry);

  // Treat the component as controlled via `value`, but maintain internal state for
  // input interactions.
  const normalizedValue = useMemo(() => ({
    name: value?.name ?? '',
    address_line1: value?.address_line1 ?? '',
    address_line2: value?.address_line2 ?? '',
    city: value?.city ?? '',
    state: value?.state ?? '',
    zip: value?.zip ?? '',
    formatted_address: value?.formatted_address ?? '',
    google_place_id: value?.google_place_id ?? '',
    latitude: value?.latitude ?? null,
    longitude: value?.longitude ?? null,
  }), [
    value?.name,
    value?.address_line1,
    value?.address_line2,
    value?.city,
    value?.state,
    value?.zip,
    value?.formatted_address,
    value?.google_place_id,
    value?.latitude,
    value?.longitude,
  ]);

  const [addressData, setAddressData] = useState(normalizedValue);

  // Keep the onChange callback stable to avoid dependency loops.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync internal state from props (so resets like value={} actually clear the UI).
  useEffect(() => {
    setAddressData((prev) => {
      const same = (
        prev.name === normalizedValue.name &&
        prev.address_line1 === normalizedValue.address_line1 &&
        prev.address_line2 === normalizedValue.address_line2 &&
        prev.city === normalizedValue.city &&
        prev.state === normalizedValue.state &&
        prev.zip === normalizedValue.zip &&
        prev.formatted_address === normalizedValue.formatted_address &&
        prev.google_place_id === normalizedValue.google_place_id &&
        prev.latitude === normalizedValue.latitude &&
        prev.longitude === normalizedValue.longitude
      );
      return same ? prev : normalizedValue;
    });
  }, [normalizedValue]);

  // Get Google Maps API key from environment.
  // Note: Vite only exposes variables prefixed with VITE_ at build time.
  const GOOGLE_MAPS_API_KEY =
    import.meta.env.VITE_GOOGLE_PLACES_API_KEY ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    '';

  useEffect(() => {
    const fn = onChangeRef.current;
    if (!fn) return;

    // Filter out 'name' field when showLocationName is false to prevent
    // overwriting company/project names with location names.
    if (!showLocationName) {
      const { name, ...addressFieldsOnly } = addressData;
      fn(addressFieldsOnly);
    } else {
      fn(addressData);
    }
  }, [addressData, showLocationName]);

  const handlePlaceSelect = (placeData) => {
    setAddressData(prev => ({
      ...prev,
      ...placeData,
      google_place_id: placeData.place_id,
      formatted_address: placeData.formatted_address,
      latitude: placeData.latitude,
      longitude: placeData.longitude
    }));
  };

  const handleManualChange = (field, fieldValue) => {
    setAddressData(prev => ({
      ...prev,
      [field]: fieldValue,
      // Clear Google Places data when manually editing
      google_place_id: '',
      formatted_address: '',
      latitude: null,
      longitude: null
    }));
  };

  const toggleMode = () => {
    if (!allowManualEntry) return;
    setManualMode(!manualMode);
  };

  if (!GOOGLE_MAPS_API_KEY || manualMode) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Address Information
          </label>
          {GOOGLE_MAPS_API_KEY && allowManualEntry && (
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Use Google Places
            </button>
          )}
        </div>
        
        {/* Name/Alias - only show if showLocationName is true */}
        {showLocationName && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location Name/Alias
            </label>
            <input
              type="text"
              value={addressData.name || ''}
              onChange={(e) => handleManualChange('name', e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
              placeholder="e.g., Warehouse A, Building 1"
              disabled={disabled}
            />
          </div>
        )}

        {/* Address Line 1 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Street Address
          </label>
          <input
            type="text"
            value={addressData.address_line1 || ''}
            onChange={(e) => handleManualChange('address_line1', e.target.value)}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
            placeholder="Street address"
            required={required}
            disabled={disabled}
          />
        </div>

        {/* Address Line 2 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Apt, Suite, etc. (optional)
          </label>
          <input
            type="text"
            value={addressData.address_line2 || ''}
            onChange={(e) => handleManualChange('address_line2', e.target.value)}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
            placeholder="Apartment, suite, unit, building, floor, etc."
            disabled={disabled}
          />
        </div>

        {/* City, State, ZIP */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              City
            </label>
            <input
              type="text"
              value={addressData.city || ''}
              onChange={(e) => handleManualChange('city', e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
              placeholder="City"
              required={required}
              disabled={disabled}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              State
            </label>
            <input
              type="text"
              value={addressData.state || ''}
              onChange={(e) => handleManualChange('state', e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
              placeholder="State"
              required={required}
              disabled={disabled}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ZIP Code
            </label>
            <input
              type="text"
              value={addressData.zip || ''}
              onChange={(e) => handleManualChange('zip', e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
              placeholder="ZIP"
              required={required}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <GoogleMapsLoader apiKey={GOOGLE_MAPS_API_KEY}>
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Address
          </label>
          {allowManualEntry && (
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Manual Entry
            </button>
          )}
        </div>
        
        {/* Name/Alias - only show if showLocationName is true */}
        {showLocationName && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location Name/Alias (optional)
            </label>
            <input
              type="text"
              value={addressData.name || ''}
              onChange={(e) => handleManualChange('name', e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 mb-4"
              placeholder="e.g., Warehouse A, Building 1"
              disabled={disabled}
            />
          </div>
        )}

        {/* Google Places Autocomplete */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Street Address
          </label>
          <SimpleGooglePlaces
            value={addressData.formatted_address || addressData.address_line1}
            onPlaceSelect={handlePlaceSelect}
            onChange={(value) => {
              // Allow manual typing to update address_line1 as fallback
              setAddressData(prev => ({
                ...prev,
                address_line1: value,
                formatted_address: '' // Clear this to indicate manual entry
              }));
            }}
            placeholder="Start typing an address..."
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
            required={required}
            disabled={disabled}
          />
        </div>

      </div>
    </GoogleMapsLoader>
  );
};

export default AddressInput;