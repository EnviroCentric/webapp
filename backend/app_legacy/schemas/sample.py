from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ValidationInfo

class SampleBase(BaseModel):
    address_id: int
    description: str = Field(..., min_length=1, max_length=255)
    cassette_barcode: str = Field(..., min_length=1)

class SampleCreate(SampleBase):
    flow_rate: float = 12
    volume_required: float = 1000

class SampleUpdate(BaseModel):
    description: Optional[str] = None
    is_inside: Optional[bool] = None
    flow_rate: Optional[int] = Field(None, ge=0)
    volume_required: Optional[int] = Field(None, ge=0)
    start_time: Optional[datetime] = None
    stop_time: Optional[datetime] = None
    fields: Optional[int] = Field(None, ge=0)
    fibers: Optional[int] = Field(None, ge=0)
    cassette_barcode: Optional[str] = None

    @field_validator('stop_time')
    @classmethod
    def validate_stop_time(cls, v: Optional[datetime], info: ValidationInfo) -> Optional[datetime]:
        if v and 'start_time' in info.data and info.data['start_time']:
            if v < info.data['start_time']:
                raise ValueError('stop_time must be after start_time')
        return v

class SampleInDB(SampleBase):
    id: int
    description: Optional[str] = None
    is_inside: Optional[bool] = None
    flow_rate: Optional[int] = None
    volume_required: Optional[int] = None
    start_time: Optional[datetime] = None
    stop_time: Optional[datetime] = None
    total_time_ran: Optional[timedelta] = None
    fields: Optional[int] = None
    fibers: Optional[int] = None
    created_at: datetime
    cassette_barcode: str

    class Config:
        from_attributes = True 