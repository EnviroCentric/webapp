import pytest
from fastapi import status
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_register_requires_auth(client: AsyncClient):
    """Registration is admin-only; unauthenticated requests are rejected."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "TestPass123!@#",
            "password_confirm": "TestPass123!@#",
            "first_name": "New",
            "last_name": "User",
        },
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


async def test_register_forbidden_for_normal_user(client: AsyncClient, normal_user_token_headers: dict):
    """Non-admin users cannot create accounts."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "TestPass123!@#",
            "password_confirm": "TestPass123!@#",
            "first_name": "New",
            "last_name": "User",
        },
        headers=normal_user_token_headers,
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


async def test_register_user_success_admin(client: AsyncClient, admin_token_headers: dict):
    """Admin can create a new user account (no tokens returned)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "TestPass123!@#",
            "password_confirm": "TestPass123!@#",
            "first_name": "New",
            "last_name": "User",
        },
        headers=admin_token_headers,
    )
    assert resp.status_code == status.HTTP_200_OK, resp.text
    data = resp.json()
    assert data["email"] == "newuser@example.com"
    assert "access_token" not in data
    assert "refresh_token" not in data


async def test_register_password_validation_and_mismatch(client: AsyncClient, admin_token_headers: dict):
    weak = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "weakpass@example.com",
            "password": "weak",
            "password_confirm": "weak",
            "first_name": "Weak",
            "last_name": "Password",
        },
        headers=admin_token_headers,
    )
    assert weak.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    mismatch = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "mismatch@example.com",
            "password": "TestPass123!@#",
            "password_confirm": "DifferentPass123!@#",
            "first_name": "Password",
            "last_name": "Mismatch",
        },
        headers=admin_token_headers,
    )
    assert mismatch.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


async def test_register_existing_user(client: AsyncClient, admin_token_headers: dict):
    # Create once
    first = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dupe@example.com",
            "password": "TestPass123!@#",
            "password_confirm": "TestPass123!@#",
            "first_name": "Dupe",
            "last_name": "User",
        },
        headers=admin_token_headers,
    )
    assert first.status_code == status.HTTP_200_OK

    # Create again
    second = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dupe@example.com",
            "password": "TestPass123!@#",
            "password_confirm": "TestPass123!@#",
            "first_name": "Dupe",
            "last_name": "User",
        },
        headers=admin_token_headers,
    )
    assert second.status_code == status.HTTP_400_BAD_REQUEST
    assert second.json()["detail"] == "Email already registered"


async def test_login_success_and_refresh_token(client: AsyncClient, admin_token_headers: dict):
    # Create user
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "loginuser@example.com",
            "password": "TestPass123!@#",
            "password_confirm": "TestPass123!@#",
            "first_name": "Login",
            "last_name": "User",
        },
        headers=admin_token_headers,
    )

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "loginuser@example.com",
            "password": "TestPass123!@#",
        },
    )
    assert login_resp.status_code == status.HTTP_200_OK
    tokens = login_resp.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"

    # Refresh
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refresh_resp.status_code == status.HTTP_200_OK
    refreshed = refresh_resp.json()
    assert "access_token" in refreshed
    assert "refresh_token" in refreshed


async def test_login_invalid_credentials(client: AsyncClient):
    invalid_email = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "nonexistent@example.com",
            "password": "TestPass123!@#",
        },
    )
    assert invalid_email.status_code == status.HTTP_401_UNAUTHORIZED


async def test_get_current_user(client: AsyncClient, normal_user_token_headers: dict):
    resp = await client.get("/api/v1/auth/me", headers=normal_user_token_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert "email" in data
    assert "id" in data


async def test_refresh_token_invalid(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid_token"},
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


async def test_refresh_token_rejected_for_inactive_user(client: AsyncClient, admin_token_headers: dict):
    created = await client.post(
        "/api/v1/users",
        json={
            "email": "inactive@example.com",
            "password": "TestPass123!@#",
            "first_name": "Inactive",
            "last_name": "User",
        },
        headers=admin_token_headers,
    )
    assert created.status_code == status.HTTP_201_CREATED
    user_id = created.json()["id"]

    login_resp = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "inactive@example.com",
            "password": "TestPass123!@#",
        },
    )
    assert login_resp.status_code == status.HTTP_200_OK
    refresh_token = login_resp.json()["refresh_token"]

    deactivate_resp = await client.patch(
        f"/api/v1/users/{user_id}",
        json={"is_active": False},
        headers=admin_token_headers,
    )
    assert deactivate_resp.status_code == status.HTTP_200_OK

    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert refresh_resp.json()["detail"] == "Inactive user"
