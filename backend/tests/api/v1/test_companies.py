import pytest
from httpx import AsyncClient
from fastapi import status

pytestmark = pytest.mark.asyncio


async def test_company_clients_endpoint_filters_to_client_role(
    client: AsyncClient,
    admin_token_headers: dict,
    field_tech_user,
):
    # Create a company
    company_resp = await client.post(
        "/api/v1/companies/",
        json={"name": "acme"},
        headers=admin_token_headers,
    )
    assert company_resp.status_code == status.HTTP_201_CREATED, company_resp.text
    company = company_resp.json()

    # Create a client user for that company
    create_client = await client.post(
        "/api/v1/users/client",
        json={
            "company_id": company["id"],
            "email": "client@acme.com",
            "first_name": "Client",
            "last_name": "User",
            "code": "1234",
        },
        headers=admin_token_headers,
    )
    assert create_client.status_code == status.HTTP_201_CREATED, create_client.text

    # Assign an employee (field tech) to the company as well
    patch_emp = await client.patch(
        f"/api/v1/users/{field_tech_user.id}",
        json={"company_id": company["id"]},
        headers=admin_token_headers,
    )
    assert patch_emp.status_code == status.HTTP_200_OK, patch_emp.text

    # Clients endpoint should only return the client-role user(s)
    resp = await client.get(
        f"/api/v1/companies/{company['id']}/clients",
        headers=admin_token_headers,
    )
    assert resp.status_code == status.HTTP_200_OK, resp.text
    data = resp.json()

    assert data["total_clients"] == 1
    assert len(data["clients"]) == 1
    assert data["clients"][0]["email"] == "client@acme.com"


async def test_company_list_includes_stats_and_primary_contact_fields(
    client: AsyncClient,
    admin_token_headers: dict,
):
    # Create a company
    company_resp = await client.post(
        "/api/v1/companies/",
        json={"name": "beta"},
        headers=admin_token_headers,
    )
    assert company_resp.status_code == status.HTTP_201_CREATED, company_resp.text
    company = company_resp.json()

    # Create a project under the company
    project_resp = await client.post(
        "/api/v1/projects/",
        json={"company_id": company["id"], "name": "Project 1"},
        headers=admin_token_headers,
    )
    assert project_resp.status_code == status.HTTP_201_CREATED, project_resp.text

    # Create a client user (for client_count + contact)
    create_client = await client.post(
        "/api/v1/users/client",
        json={
            "company_id": company["id"],
            "email": "lead@beta.com",
            "first_name": "Lead",
            "last_name": "Client",
            "code": "1234",
        },
        headers=admin_token_headers,
    )
    assert create_client.status_code == status.HTTP_201_CREATED, create_client.text

    # Pull the created client user id from /companies/{id}/clients
    clients_resp = await client.get(
        f"/api/v1/companies/{company['id']}/clients",
        headers=admin_token_headers,
    )
    assert clients_resp.status_code == status.HTTP_200_OK
    lead_id = clients_resp.json()["clients"][0]["id"]

    # Set primary contact
    upd = await client.put(
        f"/api/v1/companies/{company['id']}",
        json={"primary_contact_user_id": lead_id},
        headers=admin_token_headers,
    )
    assert upd.status_code == status.HTTP_200_OK, upd.text

    # List should include counts + contact fields
    list_resp = await client.get(
        "/api/v1/companies/",
        headers=admin_token_headers,
    )
    assert list_resp.status_code == status.HTTP_200_OK, list_resp.text

    listed = [c for c in list_resp.json() if c["id"] == company["id"]][0]
    assert listed["total_projects"] == 1
    assert listed["open_projects"] == 1
    assert listed["client_count"] == 1
    assert listed["primary_contact_user_id"] == lead_id
    assert listed["primary_contact_email"] == "lead@beta.com"
