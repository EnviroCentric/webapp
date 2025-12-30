import pytest
import asyncpg
from app.services.users import UserService
from app.schemas.user import UserCreate, UserResponse
from app.core.security import verify_password

pytestmark = pytest.mark.asyncio

async def test_create_user(db_pool: asyncpg.Pool):
    """Test creating a new user."""
    service = UserService(db_pool)
    user_data = UserCreate(
        email="test@example.com",
        password="TestPass123!@#",
        first_name="Test",
        last_name="User",
        is_active=True,
        is_superuser=False
    )
    
    user = await service.create_user(user_data)
    
    assert user is not None
    assert user.email == user_data.email
    assert user.first_name == user_data.first_name
    assert user.last_name == user_data.last_name
    assert user.is_active == user_data.is_active
    assert user.is_superuser == user_data.is_superuser
    # Fetch the user from the DB to check the hashed password
    user_in_db = await service.get_user_by_email(user_data.email)
    assert user_in_db is not None
    assert verify_password(user_data.password, user_in_db.hashed_password)

async def test_get_user_by_id(db_pool: asyncpg.Pool):
    """Test getting a user by ID."""
    service = UserService(db_pool)
    
    # First create a user
    user_data = UserCreate(
        email="test2@example.com",
        password="TestPass123!@#",
        first_name="Test",
        last_name="User 2",
        is_active=True,
        is_superuser=False
    )
    created_user = await service.create_user(user_data)
    
    # Then try to get the user
    retrieved_user = await service.get_user_by_id(created_user.id)
    
    assert retrieved_user is not None
    assert retrieved_user.id == created_user.id
    assert retrieved_user.email == created_user.email
    assert retrieved_user.first_name == created_user.first_name
    assert retrieved_user.last_name == created_user.last_name

async def test_get_nonexistent_user(db_pool: asyncpg.Pool):
    """Test getting a user that doesn't exist."""
    service = UserService(db_pool)
    user = await service.get_user_by_id(999)
    assert user is None

async def test_create_duplicate_user(db_pool: asyncpg.Pool):
    """Test creating a user with duplicate email."""
    service = UserService(db_pool)
    user_data = UserCreate(
        email="duplicate@example.com",
        password="TestPass123!@#",
        first_name="Duplicate",
        last_name="User",
        is_active=True,
        is_superuser=False
    )
    
    # Create first user
    await service.create_user(user_data)
    
    # Try to create duplicate user with same email
    duplicate_data = UserCreate(
        email="duplicate@example.com",  # Same email
        password="TestPass123!@#",
        first_name="Another",
        last_name="User",
        is_active=True,
        is_superuser=False
    )
    
    with pytest.raises(Exception):  # Should raise an exception for duplicate email
        await service.create_user(duplicate_data) 