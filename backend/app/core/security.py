from datetime import datetime, timedelta
from typing import Any, Union, Dict
from jose import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings
from app.db.session import get_db
from app.db.queries.manager import query_manager

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta | None = None, additional_claims: Dict | None = None
) -> str:
    """
    Generate a JWT access token for the given subject.

    If ``expires_delta`` is provided it should be a :class:`datetime.timedelta` and will
    be added to the current UTC time to produce the expiration timestamp.  If
    ``expires_delta`` is ``None`` the token will default to a two‑hour lifetime.
    If you want to control the default lifetime globally you can set
    ``settings.ACCESS_TOKEN_EXPIRE_MINUTES``.
    """
    # Default to a two‑hour access token if no explicit timedelta is provided.
    if expires_delta is None:
        if getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", None):
            expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        else:
            expires_delta = timedelta(hours=2)
    expire = datetime.utcnow() + expires_delta
    to_encode: Dict[str, Any] = {"exp": expire, "sub": str(subject)}
    # Merge in any custom claims (e.g. roles or superuser flag) so they are
    # carried through in the token payload.
    if additional_claims:
        to_encode.update(additional_claims)
    encoded_jwt: str = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(
    subject: Union[str, Any], expires_delta: timedelta | None = None
) -> str:
    """
    Generate a JWT refresh token for the given subject.

    Refresh tokens are intended to live longer than access tokens.  When
    ``expires_delta`` is not provided this function will default to a four‑hour
    lifetime, but will honor ``settings.REFRESH_TOKEN_EXPIRE_MINUTES`` if it is
    defined on your settings object.
    """
    if expires_delta is None:
        if getattr(settings, "REFRESH_TOKEN_EXPIRE_MINUTES", None):
            expires_delta = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        else:
            # Give refresh tokens a longer lifetime than access tokens.
            expires_delta = timedelta(hours=4)
    expire = datetime.utcnow() + expires_delta
    to_encode: Dict[str, Any] = {"exp": expire, "sub": str(subject)}
    encoded_jwt: str = jwt.encode(
        to_encode, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def verify_refresh_token(token: str) -> str:
    """Verify a refresh token and return the subject (email)."""
    try:
        payload = jwt.decode(
            token, settings.JWT_REFRESH_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            return None
        return email
    except jwt.JWTError:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def get_current_user(
    db = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> Dict:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    
    # Query user using the SQL query manager
    user = await db.fetchrow(query_manager.get_user_by_email, email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
        )
    
    # Convert user to dict and add any additional claims from the token
    user_dict = dict(user)
    if "is_superuser" in payload:
        user_dict["is_superuser"] = payload["is_superuser"]
    # Always load roles with permissions from DB
    roles = await db.fetch(query_manager.get_user_roles, user["id"])
    user_dict["roles"] = [dict(row) for row in roles]
    return user_dict