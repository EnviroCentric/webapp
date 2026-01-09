from fastapi import APIRouter, Depends, HTTPException, status
import asyncpg
from typing import List

from app.db.session import get_db
from app.schemas.role import RoleResponse, RoleCreate, RoleUpdate
from app.schemas.user import UserResponse
from app.services.roles import RoleService, get_user_role_level
from app.core.security import get_current_user
from app.db.queries.manager import query_manager
from pydantic import BaseModel

router = APIRouter(
    prefix="/roles", 
    tags=["Role Management"],
    responses={403: {"description": "Insufficient permissions"}}
)

@router.get("", response_model=List[RoleResponse])
@router.get("/", response_model=List[RoleResponse])  # Handle trailing slash
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
            detail="Insufficient permissions to create roles"
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
            detail="Insufficient permissions to update roles"
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
            detail="Insufficient permissions to delete roles"
        )
    
    role_service = RoleService(db)
    success = await role_service.delete_role(role_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Get a role by ID."""
    role_service = RoleService(db)
    role = await role_service.get_role_by_id(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    return role

class RoleAssignmentRequest(BaseModel):
    user_id: int
    role_id: int

@router.post("/assign", status_code=status.HTTP_200_OK)
async def assign_user_role(
    assignment: RoleAssignmentRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Assign a role to a user."""
    # Check role permissions using level-based system
    current_user_model = UserResponse(**current_user)
    role_level = await get_user_role_level(db, current_user_model.id)
    if not current_user_model.is_superuser and role_level < 100:  # Admin level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to assign roles"
        )
    
    # Assign role by ID directly to database
    async with db.acquire() as conn:
        try:
            await conn.execute(
                """INSERT INTO user_roles (user_id, role_id) 
                   VALUES ($1, $2) 
                   ON CONFLICT (user_id, role_id) DO NOTHING""",
                assignment.user_id, assignment.role_id
            )
            # Update user's highest_level field by recalculating from all their roles
            max_level = await conn.fetchval(
                """SELECT COALESCE(MAX(r.level), 0) 
                   FROM user_roles ur 
                   JOIN roles r ON ur.role_id = r.id 
                   WHERE ur.user_id = $1""",
                assignment.user_id
            )
            await conn.execute(
                "UPDATE users SET highest_level = $1 WHERE id = $2",
                max_level, assignment.user_id
            )
            return {"message": "Role assigned successfully"}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to assign role"
            )

@router.post("/unassign", status_code=status.HTTP_200_OK)
async def unassign_user_role(
    assignment: RoleAssignmentRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Remove a role from a user."""
    # Check role permissions using level-based system
    current_user_model = UserResponse(**current_user)
    role_level = await get_user_role_level(db, current_user_model.id)
    if not current_user_model.is_superuser and role_level < 100:  # Admin level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to unassign roles"
        )
    
    # Remove role assignment from database
    async with db.acquire() as conn:
        try:
            result = await conn.execute(
                "DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2",
                assignment.user_id, assignment.role_id
            )
            
            # Check if any rows were deleted
            if result == "DELETE 0":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Role assignment not found"
                )
            
            # Recalculate user's highest_level field after removing the role
            max_level = await conn.fetchval(
                """SELECT COALESCE(MAX(r.level), 0) 
                   FROM user_roles ur 
                   JOIN roles r ON ur.role_id = r.id 
                   WHERE ur.user_id = $1""",
                assignment.user_id
            )
            await conn.execute(
                "UPDATE users SET highest_level = $1 WHERE id = $2",
                max_level, assignment.user_id
            )
            
            return {"message": "Role unassigned successfully"}
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to unassign role"
            )
