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
