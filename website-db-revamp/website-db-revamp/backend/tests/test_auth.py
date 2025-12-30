import pytest
from fastapi import status
from httpx import AsyncClient
from app.core.config import settings
from app.schemas.user import UserCreate
from app.services.users import UserService
from app.core.security import create_access_token

pytestmark = pytest.mark.asyncio

async def test_register_user(client: AsyncClient):
    """Test registering a new user."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "TestPass123!@#",
            "password_confirm": "TestPass123!@#",
            "first_name": "New",
            "last_name": "User",
            "is_active": True,
            "is_superuser": False
        }
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert "id" in data
    assert "access_token" in data
    assert "refresh_token" in data

async def test_register_weak_password(client: AsyncClient):
    """Test registering with a weak password."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "weakpass@example.com",
            "password": "weak",
            "first_name": "Weak",
            "last_name": "Password",
            "is_active": True,
            "is_superuser": False
        }
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

async def test_register_password_mismatch(client: AsyncClient):
    """Test registering with mismatched passwords."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "mismatch@example.com",
            "password": "TestPass123!@#",
            "password_confirm": "DifferentPass123!@#",
            "first_name": "Password",
            "last_name": "Mismatch",
            "is_active": True,
            "is_superuser": False
        }
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

async def test_register_existing_user(client: AsyncClient, test_user: dict):
    """Test registration with existing email."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": test_user.email,
            "password": "TestPass123!@#",
            "password_confirm": "TestPass123!@#",
            "first_name": "New",
            "last_name": "User",
            "is_active": True,
            "is_superuser": False
        }
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "Email already registered"

async def test_login_success(client: AsyncClient, test_user: dict):
    """Test successful login."""
    response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user.email,
            "password": "TestPass123!@#"
        }
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

async def test_login_invalid_email(client: AsyncClient):
    """Test login with invalid email."""
    response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "nonexistent@example.com",
            "password": "TestPass123!@#"
        }
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND

async def test_login_invalid_password(client: AsyncClient, test_user: dict):
    """Test login with invalid password."""
    response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user.email,
            "password": "WrongPassword123!@#"
        }
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_login_missing_fields(client: AsyncClient):
    """Test login with missing fields."""
    response = await client.post(
        "/api/v1/auth/login",
        data={}
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

async def test_get_current_user(client: AsyncClient, normal_user_token_headers: dict):
    """Test getting current user with valid token."""
    response = await client.get(
        "/api/v1/auth/me",
        headers=normal_user_token_headers
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "email" in data
    assert "id" in data
    assert "first_name" in data
    assert "last_name" in data

async def test_get_current_user_invalid_token(client: AsyncClient):
    """Test getting current user with invalid token."""
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_get_current_user_no_token(client: AsyncClient):
    """Test getting current user without token."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_refresh_token(client: AsyncClient, test_user: dict):
    """Test refreshing access token."""
    # First login to get refresh token
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user.email,
            "password": "TestPass123!@#"
        }
    )
    refresh_token = login_response.json()["refresh_token"]
    
    # Then try to refresh the token
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

async def test_refresh_token_invalid(client: AsyncClient):
    """Test refreshing token with invalid refresh token."""
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid_token"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
