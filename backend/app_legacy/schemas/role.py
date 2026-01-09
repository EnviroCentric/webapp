from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None


class RoleInternal(RoleBase):
    level: int


class RoleCreate(RoleInternal):
    permissions: Optional[List[str]] = []


class RoleUpdate(RoleInternal):
    permissions: Optional[List[str]] = None


class RoleInDB(RoleInternal):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoleResponse(RoleBase):
    id: int
    level: int
    created_at: datetime
    permissions: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class RolePermissionUpdate(BaseModel):
    permissions: List[str]


class RoleOrder(BaseModel):
    role_id: int
    level: int


class RoleReorder(BaseModel):
    role_orders: List[RoleOrder]
