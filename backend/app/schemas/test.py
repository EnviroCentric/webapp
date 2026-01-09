from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class RoleBase(BaseModel):
    name: str = Field(..., description="Role name")
    description: Optional[str] = Field(None, description="Role description")
    level: int = Field(..., description="Role level (0–100)")

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    level: Optional[int] = None

class RoleResponse(RoleBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
