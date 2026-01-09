from fastapi import APIRouter, Depends, HTTPException, status
import asyncpg
from typing import List

from app.db.session import get_db
from app.schemas.role import RoleResponse, RoleCreate, RoleUpdate
from app.schemas.user import UserResponse
from app.services import RoleService
from app.core.security import get_current_user
from app.db.queries.manager import query_manager

router = APIRouter(prefix="/roles", tags=["roles"])

@router.get("", response_model=List[RoleResponse])
async def get_roles(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Get all roles."""
    role_service = RoleService(db)
    roles = await role_service.get_all_roles()
    return roles

@router.post("", response_model=RoleResponse)
async def create_role(
    role_in: RoleCreate,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Create a new role."""
    # Check if user has permission to create roles
    current_user_model = UserResponse(**current_user)
    if not (current_user_model.is_superuser or any(role.permissions and "manage_roles" in role.permissions for role in current_user_model.roles)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to create roles"
        )
    
    role_service = RoleService(db)
    role = await role_service.create_role(role_in)
    return role

@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    role_in: RoleUpdate,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Update a role."""
    # Check if user has permission to update roles
    current_user_model = UserResponse(**current_user)
    if not (current_user_model.is_superuser or any(role.permissions and "manage_roles" in role.permissions for role in current_user_model.roles)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update roles"
        )
    
    role_service = RoleService(db)
    role = await role_service.update_role(role_id, role_in)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    return role

@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Delete a role."""
    # Check if user has permission to delete roles
    current_user_model = UserResponse(**current_user)
    if not (current_user_model.is_superuser or any(role.permissions and "manage_roles" in role.permissions for role in current_user_model.roles)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete roles"
        )
    
    role_service = RoleService(db)
    success = await role_service.delete_role(role_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        ) 