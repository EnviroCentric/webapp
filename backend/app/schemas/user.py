from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator, constr, Field
from app.core.validators import validate_password


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)   # <- safer default
    level: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    company_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("first_name", "last_name")
    def validate_name(cls, v):
        if v is not None:
            # Strip whitespace and normalize to lowercase
            v = v.strip()
            if v == "":
                raise ValueError("Name cannot be empty")
            # Normalize to lowercase for database consistency
            v = v.lower()
        return v


class UserCreate(UserBase):
    email: EmailStr
    password: constr(min_length=8)
    first_name: str
    last_name: str
    phone: Optional[str] = None
    company_id: Optional[int] = None

    @field_validator("password")
    def validate_password_strength(cls, v):
        if not validate_password(v):
            raise ValueError(
                "Password must be at least 8 characters long and contain uppercase, "
                "lowercase, numbers and special characters"
            )
        return v


class UserUpdate(UserBase):
    pass


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: constr(min_length=8)

    @field_validator("new_password")
    def validate_password_strength(cls, v):
        if not validate_password(v):
            raise ValueError(
                "Password must be at least 8 characters long and contain uppercase, "
                "lowercase, numbers and special characters"
            )
        return v


class UserResponse(UserBase):
    id: int
    company_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    roles: List[RoleResponse] = Field(default_factory=list)
    is_superuser: bool = False
    highest_level: int = 0
    must_change_password: bool = False
    password_set_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("roles", mode="before")
    def parse_roles(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return v or []


class DeleteUserResponse(BaseModel):
    message: str
    user_id: int


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserWithTokens(UserResponse):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class EmployeeResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    roles: List[RoleResponse] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator("roles", mode="before")
    def parse_roles(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return v or []


class UserInDB(BaseModel):
    id: int
    company_id: Optional[int] = None
    email: str
    hashed_password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    is_active: bool
    is_superuser: bool
    highest_level: int = 0
    must_change_password: bool = False
    password_set_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
