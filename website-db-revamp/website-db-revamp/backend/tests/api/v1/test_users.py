import pytest
from fastapi import status
from httpx import AsyncClient
from app.schemas.user import UserCreate

pytestmark = pytest.mark.asyncio

# Authentication Tests
async def test_get_user_unauthorized(client: AsyncClient):
    """Test getting a user without authentication."""
    response = await client.get("/api/v1/users/1")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_get_user_authorized(client: AsyncClient, normal_user_token_headers, test_user):
    """Test getting a user with authentication."""
    response = await client.get(f"/api/v1/users/{test_user.id}", headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_200_OK

# Get All Users Tests
async def test_get_all_users_unauthorized(client: AsyncClient):
    """Test getting all users without authentication."""
    response = await client.get("/api/v1/users/")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_get_all_users_authorized_no_permission(client: AsyncClient, normal_user_token_headers):
    """Test getting all users without manage_users permission."""
    response = await client.get("/api/v1/users/", headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

async def test_get_all_users_superuser(client: AsyncClient, superuser_token_headers, test_user):
    """Test getting all users as superuser."""
    response = await client.get("/api/v1/users/", headers=superuser_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any(user["id"] == test_user.id for user in data)

async def test_get_all_users_with_permission(client: AsyncClient, admin_token_headers, test_user):
    """Test getting all users with manage_users permission."""
    response = await client.get("/api/v1/users/", headers=admin_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any(user["id"] == test_user.id for user in data)

# Update User Tests
async def test_update_user_unauthorized(client: AsyncClient):
    """Test updating a user without authentication."""
    response = await client.put("/api/v1/users/1", json={"first_name": "New Name"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_update_user_no_permission(client: AsyncClient, normal_user_token_headers, test_user):
    """Test updating another user without permission."""
    response = await client.put(
        f"/api/v1/users/{test_user.id + 1}",  # Different user ID
        json={"first_name": "New Name"},
        headers=normal_user_token_headers
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN

async def test_update_user_superuser(client: AsyncClient, superuser_token_headers, test_user):
    """Test updating a user as superuser."""
    update_data = {
        "first_name": "Super",
        "last_name": "Updated",
        "is_active": False
    }
    response = await client.put(
        f"/api/v1/users/{test_user.id}",
        json=update_data,
        headers=superuser_token_headers
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["first_name"] == update_data["first_name"]
    assert data["last_name"] == update_data["last_name"]
    assert data["is_active"] == update_data["is_active"]

async def test_update_user_with_permission(client: AsyncClient, admin_token_headers, test_user):
    """Test updating a user with manage_users permission."""
    update_data = {
        "first_name": "Admin",
        "last_name": "Updated",
        "is_active": True
    }
    response = await client.put(
        f"/api/v1/users/{test_user.id}",
        json=update_data,
        headers=admin_token_headers
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["first_name"] == update_data["first_name"]
    assert data["last_name"] == update_data["last_name"]
    assert data["is_active"] == update_data["is_active"]

async def test_update_nonexistent_user(client: AsyncClient, superuser_token_headers):
    """Test updating a non-existent user."""
    response = await client.put(
        "/api/v1/users/99999",
        json={"first_name": "New Name"},
        headers=superuser_token_headers
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND

async def test_update_user_invalid_data(client: AsyncClient, superuser_token_headers, test_user):
    """Test updating a user with invalid data."""
    response = await client.put(
        f"/api/v1/users/{test_user.id}",
        json={"email": "invalid-email"},
        headers=superuser_token_headers
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

# Current User Endpoint Tests
async def test_get_current_user_unauthorized(client: AsyncClient):
    """Test getting current user without authentication."""
    response = await client.get("/api/v1/users/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_get_current_user_success(client: AsyncClient, normal_user_token_headers, test_user):
    """Test getting current user with authentication."""
    response = await client.get("/api/v1/users/me", headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["email"] == test_user.email
    assert data["id"] == test_user.id
    assert "hashed_password" not in data

async def test_update_current_user_unauthorized(client: AsyncClient):
    """Test updating current user without authentication."""
    response = await client.put("/api/v1/users/me", json={"first_name": "New Name"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_update_current_user_success(client: AsyncClient, normal_user_token_headers):
    """Test successful update of current user."""
    update_data = {
        "first_name": "Updated",
        "last_name": "Name"
    }
    response = await client.put("/api/v1/users/me", json=update_data, headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["first_name"] == update_data["first_name"]
    assert data["last_name"] == update_data["last_name"]

async def test_update_current_user_email_already_taken(
    client: AsyncClient, 
    normal_user_token_headers, 
    test_user
):
    """Test updating current user with an email that's already taken."""
    # First create another user
    other_user_data = {
        "email": "other@example.com",
        "password": "TestPass123!@#",
        "first_name": "Other",
        "last_name": "User"
    }
    await client.post("/api/v1/users/", json=other_user_data, headers=normal_user_token_headers)
    
    # Try to update current user's email to the other user's email
    update_data = {
        "email": "other@example.com"
    }
    response = await client.put("/api/v1/users/me", json=update_data, headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Email already registered" in response.json()["detail"]

async def test_update_current_user_invalid_data(client: AsyncClient, normal_user_token_headers):
    """Test updating current user with invalid data."""
    update_data = {
        "email": "invalid-email"
    }
    response = await client.put("/api/v1/users/me", json=update_data, headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

# Input Validation Tests
async def test_create_user_invalid_email(client: AsyncClient, normal_user_token_headers):
    """Test creating a user with invalid email."""
    user_data = {
        "email": "invalid-email",
        "password": "TestPass123!@#",
        "first_name": "Test",
        "last_name": "User",
        "is_active": True,
        "is_superuser": False
    }
    response = await client.post("/api/v1/users/", json=user_data, headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

async def test_create_user_missing_password(client: AsyncClient, normal_user_token_headers):
    """Test creating a user without password."""
    user_data = {
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "is_active": True,
        "is_superuser": False
    }
    response = await client.post("/api/v1/users/", json=user_data, headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

# Business Logic Tests
async def test_create_user_success(client: AsyncClient, normal_user_token_headers):
    """Test successful user creation."""
    user_data = {
        "email": "newuser@example.com",
        "password": "TestPass123!@#",
        "first_name": "New",
        "last_name": "User",
        "is_active": True,
        "is_superuser": False
    }
    response = await client.post("/api/v1/users/", json=user_data, headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["email"] == user_data["email"]
    assert data["first_name"] == user_data["first_name"]
    assert data["last_name"] == user_data["last_name"]
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert "hashed_password" not in data

async def test_get_user_success(client: AsyncClient, test_user, normal_user_token_headers):
    """Test successful user retrieval."""
    response = await client.get(f"/api/v1/users/{test_user.id}", headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["email"] == test_user.email
    assert data["id"] == test_user.id
    assert "hashed_password" not in data

async def test_get_nonexistent_user(client: AsyncClient, normal_user_token_headers):
    """Test getting a non-existent user."""
    response = await client.get("/api/v1/users/99999", headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND

# Edge Cases
async def test_create_duplicate_user(client: AsyncClient, test_user, normal_user_token_headers):
    """Test creating a user with existing email."""
    user_data = {
        "email": test_user.email,
        "password": "TestPass123!@#",
        "first_name": "Duplicate",
        "last_name": "User",
        "is_active": True,
        "is_superuser": False
    }
    response = await client.post("/api/v1/users/", json=user_data, headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_400_BAD_REQUEST

async def test_create_user_with_long_password(client: AsyncClient, normal_user_token_headers):
    """Test creating a user with very long password."""
    user_data = {
        "email": "longpass@example.com",
        "password": "a" * 1000,  # Very long password
        "first_name": "Long",
        "last_name": "Password",
        "is_active": True,
        "is_superuser": False
    }
    response = await client.post("/api/v1/users/", json=user_data, headers=normal_user_token_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

async def test_assign_roles_success(client, admin_token_headers, test_user):
    # Get all roles
    resp = await client.get("/api/v1/roles/", headers=admin_token_headers)
    assert resp.status_code == 200
    roles = resp.json()
    role_ids = [role["id"] for role in roles if role["name"] != "admin"]
    # Assign manager and supervisor roles to test_user
    resp = await client.put(f"/api/v1/users/{test_user.id}/roles", json={"role_ids": role_ids}, headers=admin_token_headers)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Roles updated"

async def test_assign_roles_forbidden(client, test_user, normal_user_token_headers):
    # Try to assign roles as a normal user (should fail)
    resp = await client.put(f"/api/v1/users/{test_user.id}/roles", json={"role_ids": [1]}, headers=normal_user_token_headers)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

async def test_assign_roles_invalid_input(client, admin_token_headers, test_user):
    # Missing role_ids
    resp = await client.put(f"/api/v1/users/{test_user.id}/roles", json={}, headers=admin_token_headers)
    assert resp.status_code == 422
    # Non-list role_ids
    resp = await client.put(f"/api/v1/users/{test_user.id}/roles", json={"role_ids": "notalist"}, headers=admin_token_headers)
    assert resp.status_code == 422 