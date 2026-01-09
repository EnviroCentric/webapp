from typing import List, Optional, Sequence, Union
from fastapi import APIRouter, Depends, HTTPException, status, Body
import asyncpg

from app.db.session import get_db
from app.core.security import get_current_user
from app.core.validators import validate_password
from app.schemas.user import UserResponse, UserCreate, UserUpdate, PasswordUpdate, EmployeeResponse
from app.schemas.role import RoleInDB  # <- use your Role schema for stronger typing
from app.services.users import UserService
from app.db.queries.manager import query_manager

router = APIRouter(
    prefix="/users", 
    tags=["User Management"],
    responses={403: {"description": "Insufficient permissions"}}
)

MANAGE_USER_LVL = 80  # minimum role level required for admin actions


# ---------- helpers ----------

def _is_superuser(user: UserResponse) -> bool:
    return bool(getattr(user, "is_superuser", False))


def _highest_role_level(user: UserResponse) -> int:
    """
    Prefer the denormalized users.highest_level.
    Fallback to computing from roles if not present (backwards-compat).
    """
    lvl = getattr(user, "highest_level", None)
    if lvl is not None:
        try:
            return int(lvl)
        except Exception:
            return 0

    # Fallback: compute from roles (legacy path)
    roles = getattr(user, "roles", None)
    if not roles:
        return 0
    highest = 0
    for r in roles:
        if isinstance(r, dict):
            v = int(r.get("level", 0) or 0)
        else:
            v = int(getattr(r, "level", 0) or 0)
        if v > highest:
            highest = v
    return highest



# ---------- collection ----------

@router.get("", response_model=List[UserResponse])
@router.get("/", response_model=List[UserResponse])  # Handle trailing slash
async def list_users(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """
    List all users.
    Allowed if superuser OR highest role level >= MANAGE_USER_LVL (80).
    """
    cu = UserResponse(**current_user)
    if not (_is_superuser(cu) or _highest_role_level(cu) >= MANAGE_USER_LVL):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view all users",
        )
    users = await UserService(db).get_all_users()
    return users


@router.get("/employees", response_model=List[EmployeeResponse])
async def list_employees(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """
    List all employees (users with field tech roles and higher - level >= 50).
    Returns minimal data: id, name, and roles only.
    Used for project assignment. Accessible to supervisors and higher.
    """
    cu = UserResponse(**current_user)
    if not (_is_superuser(cu) or _highest_role_level(cu) >= MANAGE_USER_LVL):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view employees",
        )
    
    service = UserService(db)
    employees_data = await service.get_employees_minimal(50)  # field_tech level and higher
    return [EmployeeResponse(**emp) for emp in employees_data]


# ---------- self ----------

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return UserResponse(**current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_in: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Update your own profile.
    Enforces email uniqueness if changing email.
    """
    service = UserService(db)
    cu = UserResponse(**current_user)

    if user_in.email and user_in.email != cu.email:
        existing = await service.get_user_by_email(user_in.email)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    updated = await service.update_user(cu.id, user_in)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


@router.put("/me/password")
async def change_password(
    password_data: PasswordUpdate,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Change the current user's password.
    Requires the current password for verification.
    """
    from app.core.security import verify_password, get_password_hash
    
    service = UserService(db)
    cu = UserResponse(**current_user)
    
    # Get the user with hashed password to verify current password
    user_with_password = await service.get_user_by_id_with_password(cu.id)
    if not user_with_password:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Verify current password
    if not verify_password(password_data.current_password, user_with_password.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    new_hashed_password = get_password_hash(password_data.new_password)
    success = await service.update_user_password(cu.id, new_hashed_password)
    
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update password")
    
    return {"message": "Password updated successfully"}


# ---------- single resource ----------

@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Fetch a user by id. Requires authentication.
    """
    user = await UserService(db).get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Create a new user.
    Enforces email uniqueness; delegate password rules to service/validators.
    """

# Validate password
    if not validate_password(user_in.password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters long and contain uppercase, lowercase, numbers and special characters"
        )
    
    service = UserService(db)

    existing = await service.get_user_by_email(user_in.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    created = await service.create_user(user_in)
    return created


@router.patch("/{user_id}", response_model=UserResponse)
@router.put("/{user_id}", response_model=UserResponse)  # Add PUT for compatibility with tests
async def patch_user(
    user_id: int,
    user_in: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Partially update a user.
    Allowed for:
      • superusers
      • users with highest role level >= MANAGE_USER_LVL (80)
      • the user themselves (user_id == current_user.id)
    """
    cu = UserResponse(**current_user)
    can_update = _is_superuser(cu) or _highest_role_level(cu) >= MANAGE_USER_LVL or (cu.id == user_id)
    if not can_update:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to update user")

    service = UserService(db)
    # If changing email, enforce uniqueness
    if user_in.email:
        existing = await service.get_user_by_email(user_in.email)
        if existing and getattr(existing, "id", None) != user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    updated = await service.update_user(user_id, user_in)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


# ---------- roles management ----------

@router.put("/{user_id}/roles")
async def assign_roles(
    user_id: int,
    role_ids: List[int] = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Replace a user's roles with the given list.

    Gate:
      • superusers OR highest role level >= MANAGE_USER_LVL (80)

    Constraints (non-superusers):
      • You cannot assign any role whose level is >= your highest role level.
    """
    cu = UserResponse(**current_user)

    # Gate by role level or superuser
    if not (_is_superuser(cu) or _highest_role_level(cu) >= MANAGE_USER_LVL):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to assign roles")

    # Verify target user exists
    user = await db.fetchrow(query_manager.get_user_by_id, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Non-superusers: get their highest role level from DB (canonical source)
    current_user_highest_level = 0
    if not _is_superuser(cu):
        result = await db.fetchrow(query_manager.get_user_highest_role_level, cu.id)
        current_user_highest_level = result["highest_level"] if result and "highest_level" in result else 0

    # Validate roles exist and levels are assignable
    role_rows = []
    for rid in role_ids:
        role = await db.fetchrow(query_manager.get_role_by_id, rid)
        if not role:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role with ID {rid} not found")
        if not _is_superuser(cu) and role["level"] >= current_user_highest_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to assign this role",
            )
        role_rows.append(role)

    # Replace roles transactionally
    async with db.acquire() as conn:
        async with conn.transaction():
            await conn.execute(query_manager.delete_user_roles, user_id)
            for role in role_rows:
                await conn.execute(query_manager.insert_user_role, user_id, role["id"])

    return {"message": "Roles updated"}
