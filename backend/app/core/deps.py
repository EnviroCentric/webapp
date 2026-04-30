from typing import Dict
from fastapi import Depends, HTTPException, status
from app.db.session import get_db
from app.core.security import get_current_user
from app.schemas.user import UserResponse


async def get_current_active_user(
    current_user: Dict = Depends(get_current_user)
) -> UserResponse:
    """Get current active user as a UserResponse object."""
    if not current_user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return UserResponse(**current_user)


def require_admin(current_user: Dict = Depends(get_current_user)) -> Dict:
    """Require admin-level access (role level 100+) or superuser."""
    if current_user.get("is_superuser") or int(current_user.get("highest_level", 0) or 0) >= 100:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required",
    )


def require_manager_plus(current_user: Dict = Depends(get_current_user)) -> Dict:
    """Require manager+ access (role level 90+) or superuser."""
    if current_user.get("is_superuser") or int(current_user.get("highest_level", 0) or 0) >= 90:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Manager access required",
    )


# Re-export get_db for convenience
__all__ = [
    "get_db",
    "get_current_active_user",
    "require_admin",
    "require_manager_plus",
]
