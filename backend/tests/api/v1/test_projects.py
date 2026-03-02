import pytest
from datetime import date
from httpx import AsyncClient
from fastapi import status

pytestmark = pytest.mark.asyncio


async def _create_company(client: AsyncClient, admin_token_headers: dict, *, name: str = "test company") -> dict:
    resp = await client.post(
        "/api/v1/companies/",
        json={"name": name},
        headers=admin_token_headers,
    )
    assert resp.status_code == status.HTTP_201_CREATED, resp.text
    return resp.json()


async def _create_project(client: AsyncClient, admin_token_headers: dict, *, company_id: int, name: str) -> dict:
    resp = await client.post(
        "/api/v1/projects/",
        json={"company_id": company_id, "name": name},
        headers=admin_token_headers,
    )
    assert resp.status_code == status.HTTP_201_CREATED, resp.text
    return resp.json()


async def _create_visit(
    client: AsyncClient,
    manager_token_headers: dict,
    *,
    project_id: int,
    technician_id: int,
    description: str = "Warehouse A",
) -> dict:
    resp = await client.post(
        f"/api/v1/projects/{project_id}/visits",
        json={
            "project_id": project_id,
            "visit_date": date.today().isoformat(),
            "technician_id": technician_id,
            "description": description,
            "address_line1": "123 Test St",
            "city": "Testville",
            "state": "TS",
            "zip": "12345",
        },
        headers=manager_token_headers,
    )
    assert resp.status_code == status.HTTP_201_CREATED, resp.text
    return resp.json()


async def test_create_project_success_admin(client: AsyncClient, admin_token_headers: dict):
    """Admin (role level 100) can create a project."""
    company = await _create_company(client, admin_token_headers, name="acme")
    project = await _create_project(client, admin_token_headers, company_id=company["id"], name="Test Project")
    assert project["name"] == "Test Project"
    assert project["company_id"] == company["id"]


async def test_create_project_forbidden_field_tech(client: AsyncClient, field_tech_token_headers: dict):
    """Field tech (level 50) cannot create projects (requires supervisor+)."""
    resp = await client.post(
        "/api/v1/projects/",
        json={"company_id": 1, "name": "Should Fail"},
        headers=field_tech_token_headers,
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


async def test_get_project_requires_assignment_for_field_tech(
    client: AsyncClient,
    admin_token_headers: dict,
    field_tech_token_headers: dict,
    field_tech_user,
):
    """Non-manager employees must be assigned to access a project."""
    company = await _create_company(client, admin_token_headers, name="acme")
    project = await _create_project(client, admin_token_headers, company_id=company["id"], name="Assigned Project")

    # Unassigned access should fail
    resp = await client.get(f"/api/v1/projects/{project['id']}", headers=field_tech_token_headers)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

    # Assign field tech
    assign = await client.post(
        f"/api/v1/projects/{project['id']}/technicians",
        json={"user_id": field_tech_user.id},
        headers=admin_token_headers,
    )
    assert assign.status_code == status.HTTP_201_CREATED, assign.text

    # Now it should succeed
    resp = await client.get(f"/api/v1/projects/{project['id']}", headers=field_tech_token_headers)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["id"] == project["id"]


async def test_project_addresses_lists_visit_addresses(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
    manager_user,
):
    """Project address listing is derived from visit embedded address fields."""
    company = await _create_company(client, admin_token_headers, name="acme")
    project = await _create_project(client, admin_token_headers, company_id=company["id"], name="Address Project")

    await _create_visit(
        client,
        manager_token_headers,
        project_id=project["id"],
        technician_id=manager_user.id,
        description="Warehouse A",
    )

    resp = await client.get(f"/api/v1/projects/{project['id']}/addresses", headers=admin_token_headers)
    assert resp.status_code == status.HTTP_200_OK
    addresses = resp.json()
    assert isinstance(addresses, list)
    assert any(a.get("address_line1") == "123 Test St" for a in addresses)


@pytest.mark.parametrize("role_name", ["admin", "manager"])
async def test_assign_project_allows_admin_and_manager_roles_assigned_via_users_roles_endpoint(
    client: AsyncClient,
    admin_token_headers: dict,
    role_name: str,
):
    """Users with manager+ roles should be assignable to projects after roles are replaced via /users/{id}/roles."""
    company = await _create_company(client, admin_token_headers, name="acme")
    project = await _create_project(client, admin_token_headers, company_id=company["id"], name=f"Assign {role_name}")

    # Create a new employee user
    create_resp = await client.post(
        "/api/v1/users",
        json={
            "email": f"{role_name}.assign@example.com",
            "password": "TestPass123!@#",
            "first_name": "Role",
            "last_name": "Assignee",
            "phone": None,
            "company_id": None,
        },
        headers=admin_token_headers,
    )
    assert create_resp.status_code == status.HTTP_201_CREATED, create_resp.text
    created_user = create_resp.json()

    # Look up role id
    roles_resp = await client.get("/api/v1/roles/", headers=admin_token_headers)
    assert roles_resp.status_code == status.HTTP_200_OK, roles_resp.text
    role_id = next((r["id"] for r in roles_resp.json() if r.get("name") == role_name), None)
    assert role_id is not None, f"Role '{role_name}' not found"

    # Assign role via the endpoint used by the Admin Portal
    roles_put = await client.put(
        f"/api/v1/users/{created_user['id']}/roles",
        json={"role_ids": [role_id]},
        headers=admin_token_headers,
    )
    assert roles_put.status_code == status.HTTP_200_OK, roles_put.text

    # Verify highest_level is recalculated (used by several access-control queries)
    user_resp = await client.get(f"/api/v1/users/{created_user['id']}", headers=admin_token_headers)
    assert user_resp.status_code == status.HTTP_200_OK, user_resp.text
    assert user_resp.json().get("highest_level", 0) >= 50

    # Now project assignment should work (Admin Portal uses this endpoint)
    assign = await client.post(
        f"/api/v1/projects/{project['id']}/technicians",
        json={"user_id": created_user["id"]},
        headers=admin_token_headers,
    )
    assert assign.status_code == status.HTTP_201_CREATED, assign.text
