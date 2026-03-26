import pytest
from httpx import AsyncClient
from fastapi import status

pytestmark = pytest.mark.asyncio


async def test_get_me_unauthorized(client: AsyncClient):
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


async def test_get_me_success(client: AsyncClient, normal_user_token_headers: dict, normal_user):
    resp = await client.get("/api/v1/users/me", headers=normal_user_token_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["id"] == normal_user.id
    assert data["email"] == normal_user.email
    assert "hashed_password" not in data


async def test_list_users_forbidden_for_normal_user(client: AsyncClient, normal_user_token_headers: dict):
    resp = await client.get("/api/v1/users/", headers=normal_user_token_headers)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


async def test_list_users_allowed_for_supervisor(client: AsyncClient, supervisor_token_headers: dict, normal_user):
    resp = await client.get("/api/v1/users/", headers=supervisor_token_headers)
    assert resp.status_code == status.HTTP_200_OK
    users = resp.json()
    assert any(u["id"] == normal_user.id for u in users)


async def test_admin_create_user_requires_admin(client: AsyncClient, normal_user_token_headers: dict):
    resp = await client.post(
        "/api/v1/users",
        json={
            "email": "newuser@example.com",
            "password": "TestPass123!@#",
            "first_name": "New",
            "last_name": "User",
        },
        headers=normal_user_token_headers,
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


async def test_admin_create_user_success(client: AsyncClient, admin_token_headers: dict):
    resp = await client.post(
        "/api/v1/users",
        json={
            "email": "newuser@example.com",
            "password": "TestPass123!@#",
            "first_name": "New",
            "last_name": "User",
        },
        headers=admin_token_headers,
    )
    assert resp.status_code == status.HTTP_201_CREATED, resp.text
    data = resp.json()
    assert data["email"] == "newuser@example.com"


async def test_user_can_update_self(client: AsyncClient, normal_user_token_headers: dict, normal_user):
    resp = await client.patch(
        f"/api/v1/users/{normal_user.id}",
        json={"first_name": "Changed"},
        headers=normal_user_token_headers,
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["first_name"] == "changed"


async def test_user_cannot_update_other_user(client: AsyncClient, admin_token_headers: dict, normal_user_token_headers: dict):
    # Create another user via admin
    created = await client.post(
        "/api/v1/users",
        json={
            "email": "other@example.com",
            "password": "TestPass123!@#",
            "first_name": "Other",
            "last_name": "User",
        },
        headers=admin_token_headers,
    )
    assert created.status_code == status.HTTP_201_CREATED
    other_id = created.json()["id"]

    resp = await client.patch(
        f"/api/v1/users/{other_id}",
        json={"first_name": "Nope"},
        headers=normal_user_token_headers,
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


async def test_user_cannot_update_protected_fields_on_self(client: AsyncClient, normal_user_token_headers: dict):
    resp = await client.put(
        "/api/v1/users/me",
        json={"is_superuser": True},
        headers=normal_user_token_headers,
    )
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


async def test_user_cannot_fetch_other_user_by_id(
    client: AsyncClient,
    admin_token_headers: dict,
    normal_user_token_headers: dict,
):
    created = await client.post(
        "/api/v1/users",
        json={
            "email": "other@example.com",
            "password": "TestPass123!@#",
            "first_name": "Other",
            "last_name": "User",
        },
        headers=admin_token_headers,
    )
    assert created.status_code == status.HTTP_201_CREATED

    resp = await client.get(
        f"/api/v1/users/{created.json()['id']}",
        headers=normal_user_token_headers,
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


async def test_update_me_email_already_taken(client: AsyncClient, admin_token_headers: dict, normal_user_token_headers: dict):
    # Create another user via admin
    created = await client.post(
        "/api/v1/users",
        json={
            "email": "taken@example.com",
            "password": "TestPass123!@#",
            "first_name": "Taken",
            "last_name": "User",
        },
        headers=admin_token_headers,
    )
    assert created.status_code == status.HTTP_201_CREATED

    resp = await client.put(
        "/api/v1/users/me",
        json={"email": "taken@example.com"},
        headers=normal_user_token_headers,
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
