import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

ROLES_URL = "/api/v1/roles/"

async def create_user_with_token(client, is_superuser=False):
    # Helper to create a user and get a token
    email = f"testuser_{'admin' if is_superuser else 'user'}@example.com"
    password = "TestPass123!@#"
    # Register
    reg_resp = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "password_confirm": password,
        "first_name": "Test",
        "last_name": "User"
    })
    if reg_resp.status_code != 200:
        print("Registration failed:", reg_resp.status_code, reg_resp.text)
        pytest.fail(f"Registration failed: {reg_resp.status_code} {reg_resp.text}")
    # Login
    login_resp = await client.post("/api/v1/auth/login", data={
        "username": email,
        "password": password
    })
    if login_resp.status_code != 200:
        print("Login failed:", login_resp.status_code, login_resp.text)
        pytest.fail(f"Login failed: {login_resp.status_code} {login_resp.text}")
    token = login_resp.json().get("access_token")
    return token

async def test_get_roles_unauthorized(client):
    resp = await client.get(ROLES_URL)
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_get_roles_authorized(client, normal_user_token_headers):
    """Test getting roles with valid token."""
    response = await client.get("/api/v1/roles", headers=normal_user_token_headers)
    assert response.status_code == 200
    roles = response.json()
    assert isinstance(roles, list)
    assert len(roles) > 0
    
    # Verify role structure
    role = roles[0]
    assert "id" in role
    assert "name" in role
    assert "description" in role
    assert "level" in role  # Level should be exposed
    assert "created_at" in role
    # Note: permissions not implemented in current version
    # assert "permissions" in role

async def test_get_roles_invalid_token(client):
    headers = {"Authorization": "Bearer invalidtoken"}
    resp = await client.get(ROLES_URL, headers=headers)
    assert resp.status_code == 401

# Edge case: No roles in DB (should always have at least admin, manager, supervisor after migration)
# If you want to test this, you would need to clear the roles table, which is not recommended for shared test DBs.
# Instead, check that at least the default roles exist.
async def test_get_roles_default_roles_exist(client):
    token = await create_user_with_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(ROLES_URL, headers=headers)
    assert resp.status_code == 200, f"Roles endpoint failed: {resp.status_code} {resp.text}"
    data = resp.json()
    assert isinstance(data, list), f"Expected list, got {type(data)}: {data}"
    role_names = [role["name"] for role in data]
    assert "admin" in role_names
    assert "manager" in role_names
    assert "supervisor" in role_names 