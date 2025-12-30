"""
Google Places Essentials API service for address validation and geocoding.

This module provides functionality to interact with Google Places Essentials API
(free tier) for address autocomplete, validation, and geocoding operations.
"""

import aiohttp
import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

class PlaceDetails(BaseModel):
    """Structured place details from Google Places API."""
    place_id: str
    formatted_address: str
    latitude: float
    longitude: float
    address_components: Dict[str, Any]
    name: Optional[str] = None

class GooglePlacesService:
    """Service for interacting with Google Places Essentials API (free tier)."""
    
    GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"
    
    def __init__(self):
        self.api_key = settings.GOOGLE_MAPS_API_KEY
    
    async def geocode_address(self, address: str) -> Optional[Dict[str, float]]:
        """
        Convert an address to latitude/longitude coordinates using Geocoding API (Essentials - Free).
        
        Args:
            address: Address string to geocode
            
        Returns:
            Dictionary with 'latitude' and 'longitude' keys, or None if not found
        """
        params = {
            "address": address,
            "key": self.api_key
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.GEOCODING_URL, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("status") == "OK" and data.get("results"):
                            result = data["results"][0]
                            location = result["geometry"]["location"]
                            
                            # Extract address components
                            address_components = {}
                            for component in result.get("address_components", []):
                                for type_name in component.get("types", []):
                                    address_components[type_name] = {
                                        "long_name": component.get("long_name", ""),
                                        "short_name": component.get("short_name", "")
                                    }
                            
                            return {
                                "latitude": location["lat"],
                                "longitude": location["lng"],
                                "formatted_address": result.get("formatted_address", ""),
                                "place_id": result.get("place_id", ""),
                                "address_components": address_components
                            }
                        else:
                            logger.warning(f"Geocoding failed: {data.get('status')}")
                            return None
                    else:
                        logger.error(f"Geocoding API error: {response.status} - {await response.text()}")
                        return None
        except Exception as e:
            logger.error(f"Error calling Geocoding API: {e}")
            return None
    
    async def reverse_geocode(self, latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
        """
        Convert coordinates to an address using Reverse Geocoding API (Essentials - Free).
        
        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            
        Returns:
            Dictionary with address information, or None if not found
        """
        params = {
            "latlng": f"{latitude},{longitude}",
            "key": self.api_key
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.GEOCODING_URL, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("status") == "OK" and data.get("results"):
                            result = data["results"][0]
                            
                            # Extract address components
                            address_components = {}
                            for component in result.get("address_components", []):
                                for type_name in component.get("types", []):
                                    address_components[type_name] = {
                                        "long_name": component.get("long_name", ""),
                                        "short_name": component.get("short_name", "")
                                    }
                            
                            return {
                                "formatted_address": result.get("formatted_address", ""),
                                "place_id": result.get("place_id", ""),
                                "address_components": address_components
                            }
                        else:
                            logger.warning(f"Reverse geocoding failed: {data.get('status')}")
                            return None
                    else:
                        logger.error(f"Reverse Geocoding API error: {response.status} - {await response.text()}")
                        return None
        except Exception as e:
            logger.error(f"Error calling Reverse Geocoding API: {e}")
            return None
    
    def extract_address_parts(self, address_components: Dict[str, Any]) -> Dict[str, str]:
        """
        Extract standard address parts from geocoding address components.
        
        Args:
            address_components: Address components from geocoding response
            
        Returns:
            Dictionary with standard address components
        """
        # Build address line 1 from street number and route
        street_number = address_components.get("street_number", {}).get("long_name", "")
        route = address_components.get("route", {}).get("long_name", "")
        address_line1 = f"{street_number} {route}".strip()
        
        # Address line 2 for apartment, suite, etc.
        subpremise = address_components.get("subpremise", {}).get("long_name", "")
        address_line2 = f"Apt {subpremise}" if subpremise else ""
        
        return {
            "address_line1": address_line1,
            "address_line2": address_line2,
            "city": address_components.get("locality", {}).get("long_name", ""),
            "state": address_components.get("administrative_area_level_1", {}).get("short_name", ""),
            "zip": address_components.get("postal_code", {}).get("long_name", ""),
            "country": address_components.get("country", {}).get("long_name", "")
        }
    
    async def validate_and_enrich_address(self, address_input: Dict[str, str]) -> Dict[str, Any]:
        """
        Validate and enrich address data using Google Places APIs.
        
        Args:
            address_input: Dictionary with address fields
            
        Returns:
            Dictionary with validated and enriched address data
        """
        # Build address string from input
        full_address = self._build_address_string(address_input)
        
        if full_address:
            geocode_result = await self.geocode_address(full_address)
            if geocode_result:
                # Extract structured address parts
                address_parts = self.extract_address_parts(geocode_result["address_components"])
                
                return {
                    **address_input,
                    **address_parts,
                    "formatted_address": geocode_result["formatted_address"],
                    "latitude": geocode_result["latitude"],
                    "longitude": geocode_result["longitude"],
                    "google_place_id": geocode_result["place_id"]
                }
        
        # Return original input if validation fails
        return address_input
    
    def _build_address_string(self, address_input: Dict[str, str]) -> str:
        """Build a complete address string from address components."""
        parts = []
        
        if address_input.get("address_line1"):
            parts.append(address_input["address_line1"])
        
        if address_input.get("address_line2"):
            parts.append(address_input["address_line2"])
        
        if address_input.get("city"):
            parts.append(address_input["city"])
        
        if address_input.get("state") and address_input.get("zip"):
            parts.append(f"{address_input['state']} {address_input['zip']}")
        elif address_input.get("state"):
            parts.append(address_input["state"])
        elif address_input.get("zip"):
            parts.append(address_input["zip"])
        
        return ", ".join(parts)


# Global instance
google_places_service = GooglePlacesService()


async def get_google_places_service() -> GooglePlacesService:
    """Dependency for injecting Google Places service."""
    return google_places_service