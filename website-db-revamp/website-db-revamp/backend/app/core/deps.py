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


# Re-export get_db for convenience
__all__ = ["get_db", "get_current_active_user"]