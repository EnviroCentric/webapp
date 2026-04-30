from typing import List, Optional, Sequence, Union
import re
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
import asyncpg
from pydantic import BaseModel, Field, EmailStr, field_validator

from app.db.session import get_db
from app.core.security import get_current_user, get_password_hash
from app.core.deps import require_admin
from app.core.validators import validate_password
from app.schemas.user import UserResponse, UserCreate, UserUpdate, SelfUserUpdate, PasswordUpdate, EmployeeResponse
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
    min_role_level: Optional[int] = Query(None, ge=0),
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
    service = UserService(db)
    if min_role_level is not None:
        users = await service.get_users_by_min_role_level(min_role_level)
    else:
        users = await service.get_all_users()
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
    user_in: SelfUserUpdate,
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
    Fetch a user by id.
    Allowed for the user themselves, or users with manager-level access and above.
    """
    cu = UserResponse(**current_user)
    can_view = cu.id == user_id or _is_superuser(cu) or _highest_role_level(cu) >= MANAGE_USER_LVL
    if not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view this user",
        )

    user = await UserService(db).get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    current_user: dict = Depends(require_admin),
    db: asyncpg.Pool = Depends(get_db),
):
    """Create a new user account (admin-only)."""

    # Validate password
    if not validate_password(user_in.password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Password must be at least 8 characters long and contain uppercase, "
                "lowercase, numbers and special characters"
            ),
        )

    service = UserService(db)

    existing = await service.get_user_by_email(user_in.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    created = await service.create_user(user_in)
    return created


class ClientAccountCreate(BaseModel):
    company_id: int
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    code: str = Field(..., description="4-digit admin-selected code")

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str):
        if not re.fullmatch(r"\d{4}", v or ""):
            raise ValueError("code must be exactly 4 digits")
        return v


class ClientAccountCreated(BaseModel):
    user: UserResponse
    default_password: str


def _generate_default_client_password(company_name: str, code: str) -> str:
    # Keep it derived from company name + 4-digit code, but ensure it satisfies
    # the password guideline (uppercase/lowercase/number/special, min length).
    base = re.sub(r"[^A-Za-z0-9]", "", (company_name or "company")).strip()
    if len(base) < 2:
        base = (base + "Company")
    base = base.title()

    pw = f"{base}!{code}"

    if len(pw) < 8:
        pw = pw + ("A" * (8 - len(pw)))

    if not any(c.isupper() for c in pw):
        pw += "A"
    if not any(c.islower() for c in pw):
        pw += "a"
    if not any(c.isdigit() for c in pw):
        pw += "0"
    if not re.search(r"[^A-Za-z0-9]", pw):
        pw += "!"

    return pw


@router.post("/client", response_model=ClientAccountCreated, status_code=status.HTTP_201_CREATED)
async def create_client_account(
    payload: ClientAccountCreate,
    current_user: dict = Depends(require_admin),
    db: asyncpg.Pool = Depends(get_db),
):
    """Create a client account for a company (admin-only).

    Sets a default password derived from the company name + code and marks the
    account as requiring a password change on first login.
    """
    # Ensure company exists
    company = await db.fetchrow(query_manager.get_company, payload.company_id)
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    # Ensure email unique
    existing = await db.fetchrow(query_manager.get_user_by_email, str(payload.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    default_password = _generate_default_client_password(company.get("name"), payload.code)
    hashed_password = get_password_hash(default_password)

    async with db.acquire() as conn:
        async with conn.transaction():
            user_id = await conn.fetchval(
                query_manager.create_user_with_must_change_password,
                payload.company_id,
                str(payload.email).lower(),
                hashed_password,
                payload.first_name.strip().lower(),
                payload.last_name.strip().lower(),
                payload.phone,
                True,   # is_active
                False,  # is_superuser
                True,   # must_change_password
            )

            # Assign client role
            client_role = await conn.fetchrow("SELECT id FROM roles WHERE name = 'client'")
            if not client_role:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Client role not found",
                )
            await conn.execute(query_manager.insert_user_role, user_id, client_role["id"])
            await conn.execute(query_manager.recalc_user_highest_role_level, user_id)

            created_user_row = await conn.fetchrow(query_manager.get_user_by_id, user_id)
            if not created_user_row:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to fetch created user",
                )

    return ClientAccountCreated(
        user=UserResponse(**dict(created_user_row)),
        default_password=default_password,
    )


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
    is_elevated = _is_superuser(cu) or _highest_role_level(cu) >= MANAGE_USER_LVL
    is_self = cu.id == user_id
    can_update = is_elevated or is_self
    if not can_update:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to update user")

    service = UserService(db)
    update_data = user_in.model_dump(exclude_unset=True)

    if is_self and not is_elevated:
        forbidden_fields = {"is_active", "is_superuser", "company_id"} & set(update_data.keys())
        if forbidden_fields:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to update protected fields",
            )
        user_in = SelfUserUpdate(**update_data)

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
      • You cannot assign any role whose level is > your highest role level.
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
        if not _is_superuser(cu) and role["level"] > current_user_highest_level:
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

            # Keep denormalized users.highest_level in sync
            await conn.execute(query_manager.recalc_user_highest_role_level, user_id)

    return {"message": "Roles updated"}
