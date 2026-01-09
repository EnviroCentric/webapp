from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class RoleBase(BaseModel):
    name: str = Field(..., description="The name of the role")
    description: Optional[str] = Field(None, description="The description of the role")
    level: int = Field(..., description="The level of the role")

class RoleCreate(RoleBase):
    pass

class RoleUpdate(RoleBase):
    name: Optional[str] = Field(None, description="The name of the role")
    description: Optional[str] = Field(None, description="The description of the role")
    level: Optional[int] = Field(None, description="The level of the role")

class RoleResponse(RoleBase):
    id: int = Field(..., description="The id of the role")
    created_at: datetime = Field(..., description="The date and time the role was created")
    updated_at: Optional[datetime] = Field(None, description="The date and time the role was last updated")

    class Config:
        from_attributes = True

class RoleInDB(RoleBase):
    id: int = Field(..., description="The id of the role")
    created_at: datetime = Field(..., description="The date and time the role was created")
    updated_at: Optional[datetime] = Field(None, description="The date and time the role was last updated")

    class Config:
        from_attributes = True
