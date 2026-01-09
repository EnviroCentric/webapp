from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

class AddressBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    date: date

class AddressCreate(AddressBase):
    pass

class AddressUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)

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

class ProjectCreate(ProjectBase):
    technicians: List[int] = Field(default_factory=list)

class ProjectUpdate(ProjectBase):
    name: Optional[str] = Field(None, min_length=1, max_length=255)

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