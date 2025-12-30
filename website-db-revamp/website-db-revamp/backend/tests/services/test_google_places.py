"""
Tests for Google Places service integration.

These tests verify the Google Places API service functionality,
including address geocoding and validation.
"""

import pytest
from unittest.mock import AsyncMock, patch
from app.services.google_places import GooglePlacesService


class TestGooglePlacesService:
    """Test cases for Google Places service."""
    
    @pytest.fixture
    def places_service(self):
        """Create a Google Places service instance for testing."""
        with patch('app.services.google_places.settings') as mock_settings:
            mock_settings.GOOGLE_PLACES_API_KEY = 'test_api_key'
            return GooglePlacesService()
    
    @pytest.mark.asyncio
    async def test_geocode_address_success(self, places_service):
        """Test successful address geocoding."""
        mock_response = {
            "status": "OK",
            "results": [
                {
                    "formatted_address": "123 Main St, Anytown, CA 12345, USA",
                    "place_id": "ChIJ123456789",
                    "geometry": {
                        "location": {
                            "lat": 37.7749,
                            "lng": -122.4194
                        }
                    },
                    "address_components": [
                        {
                            "long_name": "123",
                            "short_name": "123",
                            "types": ["street_number"]
                        },
                        {
                            "long_name": "Main Street",
                            "short_name": "Main St",
                            "types": ["route"]
                        },
                        {
                            "long_name": "Anytown",
                            "short_name": "Anytown",
                            "types": ["locality", "political"]
                        },
                        {
                            "long_name": "California",
                            "short_name": "CA",
                            "types": ["administrative_area_level_1", "political"]
                        },
                        {
                            "long_name": "12345",
                            "short_name": "12345",
                            "types": ["postal_code"]
                        }
                    ]
                }
            ]
        }
        
        with patch('aiohttp.ClientSession') as mock_session:
            mock_response_obj = AsyncMock()
            mock_response_obj.status = 200
            mock_response_obj.json = AsyncMock(return_value=mock_response)
            
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response_obj
            
            result = await places_service.geocode_address("123 Main St, Anytown, CA 12345")
            
            assert result is not None
            assert result["latitude"] == 37.7749
            assert result["longitude"] == -122.4194
            assert result["formatted_address"] == "123 Main St, Anytown, CA 12345, USA"
            assert result["place_id"] == "ChIJ123456789"
            assert "address_components" in result
    
    @pytest.mark.asyncio
    async def test_geocode_address_not_found(self, places_service):
        """Test geocoding when address is not found."""
        mock_response = {
            "status": "ZERO_RESULTS",
            "results": []
        }
        
        with patch('aiohttp.ClientSession') as mock_session:
            mock_response_obj = AsyncMock()
            mock_response_obj.status = 200
            mock_response_obj.json = AsyncMock(return_value=mock_response)
            
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response_obj
            
            result = await places_service.geocode_address("Invalid Address")
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_reverse_geocode_success(self, places_service):
        """Test successful reverse geocoding."""
        mock_response = {
            "status": "OK",
            "results": [
                {
                    "formatted_address": "123 Main St, Anytown, CA 12345, USA",
                    "place_id": "ChIJ123456789",
                    "address_components": []
                }
            ]
        }
        
        with patch('aiohttp.ClientSession') as mock_session:
            mock_response_obj = AsyncMock()
            mock_response_obj.status = 200
            mock_response_obj.json = AsyncMock(return_value=mock_response)
            
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response_obj
            
            result = await places_service.reverse_geocode(37.7749, -122.4194)
            
            assert result is not None
            assert result["formatted_address"] == "123 Main St, Anytown, CA 12345, USA"
    
    def test_extract_address_parts(self, places_service):
        """Test extraction of address parts from components."""
        address_components = {
            "street_number": {"long_name": "123", "short_name": "123"},
            "route": {"long_name": "Main Street", "short_name": "Main St"},
            "locality": {"long_name": "Anytown", "short_name": "Anytown"},
            "administrative_area_level_1": {"long_name": "California", "short_name": "CA"},
            "postal_code": {"long_name": "12345", "short_name": "12345"},
            "country": {"long_name": "United States", "short_name": "US"}
        }
        
        result = places_service.extract_address_parts(address_components)
        
        assert result["address_line1"] == "123 Main Street"
        assert result["city"] == "Anytown"
        assert result["state"] == "CA"
        assert result["zip"] == "12345"
        assert result["country"] == "United States"
    
    @pytest.mark.asyncio
    async def test_validate_and_enrich_address(self, places_service):
        """Test address validation and enrichment."""
        address_input = {
            "address_line1": "123 Main St",
            "city": "Anytown",
            "state": "CA",
            "zip": "12345"
        }
        
        with patch.object(places_service, 'geocode_address') as mock_geocode:
            mock_geocode.return_value = {
                "latitude": 37.7749,
                "longitude": -122.4194,
                "formatted_address": "123 Main St, Anytown, CA 12345, USA",
                "place_id": "ChIJ123456789",
                "address_components": {
                    "street_number": {"long_name": "123", "short_name": "123"},
                    "route": {"long_name": "Main Street", "short_name": "Main St"}
                }
            }
            
            result = await places_service.validate_and_enrich_address(address_input)
            
            assert result["latitude"] == 37.7749
            assert result["longitude"] == -122.4194
            assert result["formatted_address"] == "123 Main St, Anytown, CA 12345, USA"
    
    @pytest.mark.asyncio
    async def test_api_error_handling(self, places_service):
        """Test handling of API errors."""
        with patch('aiohttp.ClientSession') as mock_session:
            mock_response_obj = AsyncMock()
            mock_response_obj.status = 403  # API key error
            mock_response_obj.text = AsyncMock(return_value="Forbidden")
            
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response_obj
            
            result = await places_service.geocode_address("123 Main St")
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_network_error_handling(self, places_service):
        """Test handling of network errors."""
        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.side_effect = Exception("Network error")
            
            result = await places_service.geocode_address("123 Main St")
            
            assert result is None