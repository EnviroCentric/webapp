from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SampleBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    cassette_barcode: str = Field(..., min_length=1)


class SampleCreate(SampleBase):
    project_id: int
    visit_id: int
    is_inside: Optional[bool] = None
    flow_rate: int = Field(12, ge=0)
    volume_required: int = Field(1000, ge=0)


class SampleUpdate(BaseModel):
    description: Optional[str] = None
    is_inside: Optional[bool] = None
    flow_rate: Optional[int] = Field(None, ge=0)
    volume_required: Optional[int] = Field(None, ge=0)
    sample_status: Optional[str] = None
    reject_reason: Optional[str] = None
    cassette_barcode: Optional[str] = None


class SampleInDB(SampleBase):
    id: int
    project_id: int
    visit_id: Optional[int] = None
    collected_by: Optional[int] = None
    collected_at: Optional[datetime] = None
    sample_status: Optional[str] = None
    reject_reason: Optional[str] = None
    flow_rate: Optional[int] = None
    volume_required: Optional[int] = None
    is_inside: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Joined/derived fields
    project_name: Optional[str] = None
    visit_description: Optional[str] = None
    collected_by_name: Optional[str] = None

    class Config:
        from_attributes = True
