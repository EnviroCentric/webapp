import pytest
from httpx import AsyncClient
from fastapi import status

pytestmark = pytest.mark.asyncio

ROLES_URL = "/api/v1/roles/"


async def test_get_roles_unauthorized(client: AsyncClient):
    resp = await client.get(ROLES_URL)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


async def test_get_roles_authorized(client: AsyncClient, normal_user_token_headers: dict):
    """Any authenticated user can list roles."""
    resp = await client.get(ROLES_URL, headers=normal_user_token_headers)
    assert resp.status_code == status.HTTP_200_OK

    roles = resp.json()
    assert isinstance(roles, list)
    assert len(roles) > 0

    role_names = {r["name"] for r in roles}
    # Seeded by migration 0001
    assert "admin" in role_names
    assert "manager" in role_names
    assert "supervisor" in role_names
    assert "field_tech" in role_names
    assert "client" in role_names


async def test_get_roles_invalid_token(client: AsyncClient):
    headers = {"Authorization": "Bearer invalidtoken"}
    resp = await client.get(ROLES_URL, headers=headers)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
