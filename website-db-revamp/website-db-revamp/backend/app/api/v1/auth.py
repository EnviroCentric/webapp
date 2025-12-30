from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import create_access_token, create_refresh_token, verify_password, verify_refresh_token, get_current_user
from app.services.users import UserService
from app.db.session import get_db
import asyncpg
import logging
from app.schemas.user import UserCreate, UserResponse, TokenResponse, UserWithTokens, UserInDB
from app.schemas.auth import RefreshTokenRequest
from app.core.validators import validate_email
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Authentication"],
    responses={401: {"description": "Authentication failed"}}
)

class RegisterRequest(UserCreate):
    password_confirm: str

    @field_validator("password_confirm")
    def passwords_match(cls, v, values):
        if "password" in values.data and v != values.data["password"]:
            raise ValueError("Passwords do not match")
        return v

@router.post("/register", response_model=UserWithTokens)
async def register(
    user_in: RegisterRequest,
    db: asyncpg.Pool = Depends(get_db)
):
    """Register a new user."""
    # Validate email format
    is_valid, error_message = validate_email(user_in.email)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )
    
    user_service = UserService(db)
    
    # Check if user already exists
    existing_user = await user_service.get_user_by_email(user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = await user_service.create_user(user_in)
    
    # Generate tokens
    access_token = create_access_token(subject=user.email)
    refresh_token = create_refresh_token(subject=user.email)
    
    # Add tokens to response
    response = user.model_dump()
    response["access_token"] = access_token
    response["refresh_token"] = refresh_token
    response["token_type"] = "bearer"
    
    return response

@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: asyncpg.Pool = Depends(get_db)
):
    """Login endpoint."""
    try:
        user_service = UserService(db)
        
        # Check if user exists
        user = await user_service.get_user_by_email(form_data.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verify password
        if not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        # Create tokens
        access_token = create_access_token(subject=user.email)
        refresh_token = create_refresh_token(subject=user.email)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: asyncpg.Pool = Depends(get_db)
):
    """Refresh access token."""
    # Verify the refresh token and get the user email
    user_email = verify_refresh_token(request.refresh_token)
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Get the user to ensure they still exist
    user_service = UserService(db)
    user = await user_service.get_user_by_email(user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Generate new tokens
    return {
        "access_token": create_access_token(subject=user_email),
        "refresh_token": create_refresh_token(subject=user_email),
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    """Get current user endpoint."""
    return UserResponse(**current_user) 