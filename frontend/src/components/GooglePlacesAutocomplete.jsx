import React, { useEffect, useRef, useState } from 'react';

/**
 * Simple Google Places Autocomplete component
 * Uses a direct implementation to avoid API conflicts
 */
const GooglePlacesAutocomplete = ({ 
  value, 
  onChange, 
  onPlaceSelect, 
  placeholder = "Enter address...",
  className = "",
  required = false,
  disabled = false,
  type = "address"
}) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    // Check if Google Maps API is loaded
    const checkGoogleMapsLoaded = () => {
      console.log('DEBUG: Checking Google Maps API...', {
        google: !!window.google,
        maps: !!(window.google && window.google.maps),
        places: !!(window.google && window.google.maps && window.google.maps.places)
      });
      
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('DEBUG: Google Maps API loaded successfully');
        setIsLoaded(true);
        initializeAutocomplete();
      } else {
        setTimeout(checkGoogleMapsLoaded, 100);
      }
    };

    checkGoogleMapsLoaded();
  }, []);

  const initializeAutocomplete = () => {
    console.log('DEBUG: initializeAutocomplete called', {
      inputRef: !!inputRef.current,
      autocompleteRef: !!autocompleteRef.current,
      type: type
    });
    
    if (!inputRef.current || autocompleteRef.current) {
      console.log('DEBUG: Skipping autocomplete init - missing input or already initialized');
      return;
    }

    try {
      console.log('DEBUG: Creating Google Places Autocomplete...');
      // Initialize the autocomplete
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: [type],
        fields: ['place_id', 'formatted_address', 'address_components', 'geometry']
      });

      console.log('DEBUG: Autocomplete created successfully');
      autocompleteRef.current = autocomplete;

      // Listen for place selection
      autocomplete.addListener('place_changed', handlePlaceChanged);
      console.log('DEBUG: place_changed listener added');
    } catch (error) {
      console.error('DEBUG: Error creating autocomplete:', error);
      setError('Failed to initialize Google Places autocomplete');
    }
  };

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current.getPlace();
    
    if (!place || !place.geometry) {
      setError("No location details available for this address");
      return;
    }

    const addressData = {
      place_id: place.place_id,
      formatted_address: place.formatted_address,
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
      address_components: place.address_components || []
    };

    // Extract structured address parts
    const extractedParts = extractAddressParts(addressData.address_components);
    
    const enrichedData = {
      ...addressData,
      ...extractedParts
    };

    setError(null);
    setInputValue(place.formatted_address);
    
    if (onPlaceSelect) {
      onPlaceSelect(enrichedData);
    }
  };

  const extractAddressParts = (components) => {
    const parts = {
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip: '',
      country: ''
    };

    if (!components || !Array.isArray(components)) return parts;

    let streetNumber = '';
    let route = '';

    components.forEach(component => {
      const types = component.types || [];
      
      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (types.includes('route')) {
        route = component.long_name;
      } else if (types.includes('subpremise')) {
        parts.address_line2 = `Apt ${component.long_name}`;
      } else if (types.includes('locality')) {
        parts.city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        parts.state = component.short_name;
      } else if (types.includes('postal_code')) {
        parts.zip = component.long_name;
      } else if (types.includes('country')) {
        parts.country = component.long_name;
      }
    });

    // Build address line 1 from street number and route
    parts.address_line1 = `${streetNumber} ${route}`.trim();

    return parts;
  };

  const handleInputChange = (event) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={isLoaded ? placeholder : "Loading Google Places..."}
        className={className}
        required={required}
        disabled={disabled || !isLoaded}
      />
      {error && (
        <div className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
};

/**
 * Google Maps API Loader component
 * This component loads the standard Google Maps JavaScript API
 */
export const GoogleMapsLoader = ({ apiKey, children }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if Google Maps API is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsLoaded(true);
      return;
    }

    if (!apiKey) {
      setError('Google Maps API key is required');
      return;
    }

    // Check if script is already loading/loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);
    if (existingScript) {
      // Script already exists, wait for it to load
      const checkLoaded = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          setIsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      
      return () => clearInterval(checkLoaded);
    }

    // Load the Google Maps JavaScript API
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Wait a bit for the API to fully initialize
      setTimeout(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          setIsLoaded(true);
          setError(null);
        } else {
          setError('Google Maps API failed to initialize properly');
        }
      }, 200);
    };

    script.onerror = () => {
      setError('Failed to load Google Maps API');
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount to avoid issues with other components
    };
  }, [apiKey]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
        <p className="text-sm text-red-800 dark:text-red-200">
          {error}
        </p>
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
          Please check your API key and internet connection.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading Google Maps...</span>
      </div>
    );
  }

  return children;
};

export default GooglePlacesAutocomplete;
