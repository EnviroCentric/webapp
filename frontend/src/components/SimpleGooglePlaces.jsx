import React, { useEffect, useRef, useState } from 'react';

/**
 * Simple Google Places input using HTML5 autocomplete and Google Places Service
 * This avoids the deprecated Autocomplete widget and API conflicts
 */
const SimpleGooglePlaces = ({ 
  value, 
  onChange, 
  onPlaceSelect, 
  placeholder = "Enter address...",
  className = "",
  required = false,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 400 });
  const inputRef = useRef(null);
  const serviceRef = useRef(null);
  const sessionTokenRef = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    // Add scroll and resize listeners to update dropdown position
    const handleScroll = () => {
      if (showSuggestions) {
        updateDropdownPosition();
      }
    };

    const handleResize = () => {
      if (showSuggestions) {
        updateDropdownPosition();
      }
    };

    if (showSuggestions) {
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [showSuggestions]);

  useEffect(() => {
    // Initialize Google Places Service when API is loaded
    const initService = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        serviceRef.current = new window.google.maps.places.AutocompleteService();
        // Create a session token for billing optimization
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      } else {
        setTimeout(initService, 100);
      }
    };
    
    initService();
  }, []);

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const newPosition = {
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 400)
      };
      setDropdownPosition(newPosition);
    }
  };

  const searchPlaces = async (query) => {
    if (!serviceRef.current || !query.trim() || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    try {
      const request = {
        input: query,
        sessionToken: sessionTokenRef.current,
        types: ['address']
      };

      serviceRef.current.getPlacePredictions(request, (predictions, status) => {
        setIsLoading(false);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions.slice(0, 5)); // Limit to 5 suggestions
          updateDropdownPosition();
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      });
    } catch (error) {
      console.error('Error searching places:', error);
      setIsLoading(false);
      setSuggestions([]);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (onChange) {
      onChange(newValue);
    }

    // Search for places after a short delay
    setTimeout(() => searchPlaces(newValue), 300);
  };

  const selectPlace = (prediction) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) return;

    const placesService = new window.google.maps.places.PlacesService(
      document.createElement('div')
    );

    const request = {
      placeId: prediction.place_id,
      fields: ['place_id', 'formatted_address', 'address_components', 'geometry'],
      sessionToken: sessionTokenRef.current
    };

    placesService.getDetails(request, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        setInputValue(place.formatted_address);
        setShowSuggestions(false);
        setSuggestions([]);
        
        // Create new session token for next search
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();

        // Extract address components
        const addressData = extractAddressParts(place);
        
        if (onPlaceSelect) {
          onPlaceSelect(addressData);
        }
      }
    });
  };

  const extractAddressParts = (place) => {
    const parts = {
      place_id: place.place_id,
      formatted_address: place.formatted_address,
      latitude: place.geometry?.location?.lat() || null,
      longitude: place.geometry?.location?.lng() || null,
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip: '',
      country: ''
    };

    if (place.address_components) {
      let streetNumber = '';
      let route = '';

      place.address_components.forEach(component => {
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

      parts.address_line1 = `${streetNumber} ${route}`.trim();
    }

    return parts;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => setShowSuggestions(false), 150);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => {
          if (suggestions.length > 0) {
            updateDropdownPosition();
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        className={className}
        required={required}
        disabled={disabled}
        autoComplete="off"
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="fixed z-[9999] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-xl max-h-80 overflow-y-auto"
             style={{
               top: dropdownPosition.top,
               left: dropdownPosition.left,
               width: dropdownPosition.width
             }}>
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.place_id}
              className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
              onClick={() => selectPlace(suggestion)}
            >
              <div className="font-medium text-gray-900 dark:text-white text-sm">
                {suggestion.structured_formatting?.main_text || suggestion.description}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                {suggestion.structured_formatting?.secondary_text}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  );
};

export default SimpleGooglePlaces;
