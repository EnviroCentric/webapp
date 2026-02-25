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


async def test_create_sample_success(client: AsyncClient, admin_token_headers: dict, manager_token_headers: dict, manager_user):
    """Technician+ can create samples for a visit."""
    company = await _create_company(client, admin_token_headers, name="acme")
    project = await _create_project(client, admin_token_headers, company_id=company["id"], name="Sample Project")
    visit = await _create_visit(
        client,
        manager_token_headers,
        project_id=project["id"],
        technician_id=manager_user.id,
    )

    sample_resp = await client.post(
        "/api/v1/samples/",
        json={
            "project_id": project["id"],
            "visit_id": visit["id"],
            "description": "Test sample",
            "cassette_barcode": "BC-ABC123",
        },
        headers=manager_token_headers,
    )
    assert sample_resp.status_code == status.HTTP_200_OK, sample_resp.text
    data = sample_resp.json()
    assert data["project_id"] == project["id"]
    assert data["visit_id"] == visit["id"]
    assert data["cassette_barcode"] == "BC-ABC123"
    assert data["sample_status"] == "collected"


async def test_create_sample_unauthorized(client: AsyncClient, normal_user_token_headers: dict):
    """Users below technician level cannot create samples."""
    resp = await client.post(
        "/api/v1/samples/",
        json={
            "project_id": 1,
            "visit_id": 1,
            "description": "Test sample",
            "cassette_barcode": "BC-ABC123",
        },
        headers=normal_user_token_headers,
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


async def test_get_sample_not_found(client: AsyncClient, manager_token_headers: dict):
    resp = await client.get("/api/v1/samples/999999", headers=manager_token_headers)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


async def test_update_sample_success(client: AsyncClient, admin_token_headers: dict, manager_token_headers: dict, manager_user):
    company = await _create_company(client, admin_token_headers, name="acme")
    project = await _create_project(client, admin_token_headers, company_id=company["id"], name="Sample Project")
    visit = await _create_visit(
        client,
        manager_token_headers,
        project_id=project["id"],
        technician_id=manager_user.id,
    )

    create_resp = await client.post(
        "/api/v1/samples/",
        json={
            "project_id": project["id"],
            "visit_id": visit["id"],
            "description": "Test sample",
            "cassette_barcode": "BC-ABC123",
        },
        headers=manager_token_headers,
    )
    sample_id = create_resp.json()["id"]

    update_resp = await client.patch(
        f"/api/v1/samples/{sample_id}",
        json={
            "description": "Updated description",
            "is_inside": True,
            "flow_rate": 15,
            "volume_required": 1200,
            "sample_status": "prepared",
        },
        headers=manager_token_headers,
    )
    assert update_resp.status_code == status.HTTP_200_OK, update_resp.text
    data = update_resp.json()
    assert data["description"] == "Updated description"
    assert data["is_inside"] is True
    assert data["flow_rate"] == 15
    assert data["volume_required"] == 1200
    assert data["sample_status"] == "prepared"


async def test_delete_sample_requires_supervisor(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
    supervisor_token_headers: dict,
    field_tech_token_headers: dict,
    manager_user,
):
    company = await _create_company(client, admin_token_headers, name="acme")
    project = await _create_project(client, admin_token_headers, company_id=company["id"], name="Sample Project")
    visit = await _create_visit(
        client,
        manager_token_headers,
        project_id=project["id"],
        technician_id=manager_user.id,
    )

    create_resp = await client.post(
        "/api/v1/samples/",
        json={
            "project_id": project["id"],
            "visit_id": visit["id"],
            "description": "Test sample",
            "cassette_barcode": "BC-ABC123",
        },
        headers=manager_token_headers,
    )
    sample_id = create_resp.json()["id"]

    denied = await client.delete(f"/api/v1/samples/{sample_id}", headers=field_tech_token_headers)
    assert denied.status_code == status.HTTP_403_FORBIDDEN

    ok = await client.delete(f"/api/v1/samples/{sample_id}", headers=supervisor_token_headers)
    assert ok.status_code == status.HTTP_204_NO_CONTENT


async def test_get_samples_by_visit_lists_created_sample(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
    manager_user,
):
    company = await _create_company(client, admin_token_headers, name="acme")
    project = await _create_project(client, admin_token_headers, company_id=company["id"], name="Sample Project")
    visit = await _create_visit(
        client,
        manager_token_headers,
        project_id=project["id"],
        technician_id=manager_user.id,
    )

    await client.post(
        "/api/v1/samples/",
        json={
            "project_id": project["id"],
            "visit_id": visit["id"],
            "description": "Test sample",
            "cassette_barcode": "BC-ABC123",
        },
        headers=manager_token_headers,
    )

    resp = await client.get(f"/api/v1/samples/visit/{visit['id']}", headers=manager_token_headers)
    assert resp.status_code == status.HTTP_200_OK
    samples = resp.json()
    assert any(s.get("cassette_barcode") == "BC-ABC123" for s in samples)


async def test_get_samples_by_address_is_gone(client: AsyncClient, manager_token_headers: dict):
    """Address-scoped sample listing is deprecated after migration 0007."""
    resp = await client.get("/api/v1/samples/address/123", headers=manager_token_headers)
    assert resp.status_code == status.HTTP_410_GONE
