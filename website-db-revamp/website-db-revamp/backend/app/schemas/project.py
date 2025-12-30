from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

# Address schemas are now removed - address data is embedded in ProjectVisit schemas

# Project schemas for new workflow structure
class ProjectCreate(BaseModel):
    company_id: int
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = Field(default="open", pattern="^(open|closed|reopened)$")
    current_start_date: Optional[date] = None
    current_end_date: Optional[date] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(open|closed|reopened)$")
    current_start_date: Optional[date] = None
    current_end_date: Optional[date] = None

class ProjectResponse(BaseModel):
    id: int
    company_id: int
    company_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    status: str
    current_start_date: Optional[date] = None
    current_end_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    @field_validator('created_at', 'updated_at', mode='before')
    @classmethod
    def validate_datetime(cls, v):
        if isinstance(v, str):
            return datetime.fromisoformat(v.replace('Z', '+00:00'))
        return v

    class Config:
        from_attributes = True

# Project visit schemas (now includes embedded address data)
class ProjectVisitCreate(BaseModel):
    project_id: int
    visit_date: date
    technician_id: int
    notes: Optional[str] = None
    description: Optional[str] = None  # Location-specific name (e.g., "Warehouse A")
    
    # Traditional address fields (legacy/manual entry)
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None  # Legacy field, prefer locality
    state: Optional[str] = None  # Legacy field, prefer administrative_area_level_1
    zip: Optional[str] = None  # Legacy field, prefer postal_code
    
    # Google Places integration fields
    formatted_address: Optional[str] = None
    google_place_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_types: Optional[List[str]] = None
    
    # Enhanced Google Places address components
    country: Optional[str] = Field(None, max_length=2, description="ISO country code (2 characters)")
    postal_code: Optional[str] = Field(None, max_length=20)
    administrative_area_level_1: Optional[str] = None  # State/province
    administrative_area_level_2: Optional[str] = None  # County
    locality: Optional[str] = None  # City
    sublocality: Optional[str] = None  # Neighborhood
    route: Optional[str] = None  # Street name
    street_number: Optional[str] = None  # Street number
    plus_code: Optional[str] = None  # Google Plus Code
    
    # Backward compatibility field (temporary)
    name: Optional[str] = None  # Will be mapped to description

class ProjectVisitUpdate(BaseModel):
    visit_date: Optional[date] = None
    technician_id: Optional[int] = None
    notes: Optional[str] = None
    description: Optional[str] = None
    
    # Address fields can also be updated
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    formatted_address: Optional[str] = None
    google_place_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_types: Optional[List[str]] = None
    country: Optional[str] = Field(None, max_length=2)
    postal_code: Optional[str] = Field(None, max_length=20)
    administrative_area_level_1: Optional[str] = None
    administrative_area_level_2: Optional[str] = None
    locality: Optional[str] = None
    sublocality: Optional[str] = None
    route: Optional[str] = None
    street_number: Optional[str] = None
    plus_code: Optional[str] = None

class ProjectVisitResponse(BaseModel):
    id: int
    project_id: int
    visit_date: date
    technician_id: int
    notes: Optional[str] = None
    description: Optional[str] = None  # Location-specific name
    
    # Address fields
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    formatted_address: Optional[str] = None
    google_place_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_types: Optional[List[str]] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    administrative_area_level_1: Optional[str] = None
    administrative_area_level_2: Optional[str] = None
    locality: Optional[str] = None
    sublocality: Optional[str] = None
    route: Optional[str] = None
    street_number: Optional[str] = None
    plus_code: Optional[str] = None
    
    # Additional fields
    technician_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Legacy support (keeping for backward compatibility during transition)
class AddressBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    date: date

class AddressInDB(AddressBase):
    id: int
    sample_ids: List[int] = Field(default_factory=list)
    created_at: date

    @field_validator('created_at', mode='before')
    @classmethod
    def validate_created_at(cls, v):
        if isinstance(v, datetime):
            return v.date()
        return v

    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

class ProjectInDB(ProjectBase):
    id: int
    address_ids: List[int] = Field(default_factory=list)
    created_at: date

    @field_validator('created_at', mode='before')
    @classmethod
    def validate_created_at(cls, v):
        if isinstance(v, datetime):
            return v.date()
        return v

    class Config:
        from_attributes = True

class ProjectWithAddresses(ProjectInDB):
    addresses: List[AddressInDB] = Field(default_factory=list)

class ProjectTechnicianAssign(BaseModel):
    user_id: int

class ProjectTechnicianRemove(BaseModel):
    user_id: int
