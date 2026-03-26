import pytest
from httpx import AsyncClient
from fastapi import status

pytestmark = pytest.mark.asyncio


async def _create_company_and_project(client: AsyncClient, admin_token_headers: dict) -> tuple[dict, dict]:
    company_resp = await client.post(
        "/api/v1/companies/",
        json={"name": "acme"},
        headers=admin_token_headers,
    )
    assert company_resp.status_code == status.HTTP_201_CREATED, company_resp.text
    company = company_resp.json()

    project_resp = await client.post(
        "/api/v1/projects/",
        json={"company_id": company["id"], "name": "Project 1"},
        headers=admin_token_headers,
    )
    assert project_resp.status_code == status.HTTP_201_CREATED, project_resp.text
    project = project_resp.json()

    return company, project


async def _create_client_user(client: AsyncClient, admin_token_headers: dict, *, company_id: int, email: str) -> str:
    resp = await client.post(
        "/api/v1/users/client",
        json={
            "company_id": company_id,
            "email": email,
            "first_name": "Client",
            "last_name": "User",
            "code": "1234",
        },
        headers=admin_token_headers,
    )
    assert resp.status_code == status.HTTP_201_CREATED, resp.text
    return resp.json()["default_password"]


async def _login(client: AsyncClient, *, email: str, password: str) -> dict:
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert login_resp.status_code == status.HTTP_200_OK, login_resp.text
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_manager_can_upload_pdf_and_client_can_download(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
    field_tech_user,
):
    company, project = await _create_company_and_project(client, admin_token_headers)

    client_email = "client@acme.com"
    default_password = await _create_client_user(
        client,
        admin_token_headers,
        company_id=company["id"],
        email=client_email,
    )
    client_headers = await _login(client, email=client_email, password=default_password)

    pdf_bytes = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"

    upload_resp = await client.post(
        "/api/v1/reports/upload",
        data={
            "project_id": str(project["id"]),
            "report_kind": "area",
            "report_date": "2026-02-24",
            "formatted_address": "123 Main St, Testville, TX 00000",
            "google_place_id": "place_123",
            "location_label": "Boiler Room",
            "technician_user_id": str(field_tech_user.id),
            "technician_name": "Field Tech",
        },
        files={"file": ("report.pdf", pdf_bytes, "application/pdf")},
        headers=manager_token_headers,
    )
    assert upload_resp.status_code == status.HTTP_201_CREATED, upload_resp.text
    report = upload_resp.json()
    assert report["project_id"] == project["id"]
    assert report["client_visible"] is True
    assert report["is_final"] is True
    assert report["report_kind"] == "area"
    assert report["report_date"] == "2026-02-24"
    assert report["google_place_id"] == "place_123"
    assert report["formatted_address"]
    assert report["technician_user_id"] == field_tech_user.id
    assert report["technician_name"] == "Field Tech"

    dl = await client.get(f"/api/v1/reports/{report['id']}/download", headers=client_headers)
    assert dl.status_code == status.HTTP_200_OK
    assert dl.headers.get("content-type", "").startswith("application/pdf")
    assert dl.content.startswith(b"%PDF")


async def test_client_can_download_reports_regardless_of_visibility_or_final_flags(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
):
    company, project = await _create_company_and_project(client, admin_token_headers)

    client_email = "client2@acme.com"
    default_password = await _create_client_user(
        client,
        admin_token_headers,
        company_id=company["id"],
        email=client_email,
    )
    client_headers = await _login(client, email=client_email, password=default_password)

    pdf_bytes = b"%PDF-1.4\n%%EOF\n"

    upload_resp = await client.post(
        "/api/v1/reports/upload",
        data={
            "project_id": str(project["id"]),
            "report_kind": "clearance",
            "report_date": "2026-02-24",
            "formatted_address": "123 Main St, Testville, TX 00000",
            "google_place_id": "place_123",
            "location_label": "Attic",
        },
        files={"file": ("report.pdf", pdf_bytes, "application/pdf")},
        headers=manager_token_headers,
    )
    assert upload_resp.status_code == status.HTTP_201_CREATED
    report_id = upload_resp.json()["id"]

    dl = await client.get(f"/api/v1/reports/{report_id}/download", headers=client_headers)
    assert dl.status_code == status.HTTP_200_OK


async def test_client_cannot_upload_report(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
):
    company, project = await _create_company_and_project(client, admin_token_headers)

    client_email = "client3@acme.com"
    default_password = await _create_client_user(
        client,
        admin_token_headers,
        company_id=company["id"],
        email=client_email,
    )
    client_headers = await _login(client, email=client_email, password=default_password)

    pdf_bytes = b"%PDF-1.4\n%%EOF\n"

    upload_resp = await client.post(
        "/api/v1/reports/upload",
        data={
            "project_id": str(project["id"]),
            "report_kind": "area",
            "report_date": "2026-02-24",
            "formatted_address": "123 Main St, Testville, TX 00000",
            "google_place_id": "place_123",
        },
        files={"file": ("report.pdf", pdf_bytes, "application/pdf")},
        headers=client_headers,
    )
    assert upload_resp.status_code == status.HTTP_403_FORBIDDEN


async def test_employee_below_manager_must_be_assigned_to_download(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
    supervisor_token_headers: dict,
    field_tech_token_headers: dict,
    field_tech_user,
):
    company, project = await _create_company_and_project(client, admin_token_headers)

    pdf_bytes = b"%PDF-1.4\n%%EOF\n"

    upload_resp = await client.post(
        "/api/v1/reports/upload",
        data={
            "project_id": str(project["id"]),
            "report_kind": "area",
            "report_date": "2026-02-24",
            "formatted_address": "123 Main St, Testville, TX 00000",
            "google_place_id": "place_123",
            "location_label": "Basement",
        },
        files={"file": ("report.pdf", pdf_bytes, "application/pdf")},
        headers=manager_token_headers,
    )
    assert upload_resp.status_code == status.HTTP_201_CREATED, upload_resp.text
    report_id = upload_resp.json()["id"]

    # Field tech is technician+ but should be blocked until assigned to the project
    dl_denied = await client.get(f"/api/v1/reports/{report_id}/download", headers=field_tech_token_headers)
    assert dl_denied.status_code == status.HTTP_403_FORBIDDEN

    assign_resp = await client.post(
        f"/api/v1/projects/{project['id']}/technicians",
        json={"user_id": field_tech_user.id},
        headers=supervisor_token_headers,
    )
    assert assign_resp.status_code == status.HTTP_201_CREATED, assign_resp.text

    dl_ok = await client.get(f"/api/v1/reports/{report_id}/download", headers=field_tech_token_headers)
    assert dl_ok.status_code == status.HTTP_200_OK
    assert dl_ok.content.startswith(b"%PDF")


async def test_cross_company_client_cannot_download_other_company_report(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
):
    company_a, project_a = await _create_company_and_project(client, admin_token_headers)

    company_b_resp = await client.post(
        "/api/v1/companies/",
        json={"name": "beta"},
        headers=admin_token_headers,
    )
    assert company_b_resp.status_code == status.HTTP_201_CREATED, company_b_resp.text
    company_b = company_b_resp.json()

    client_email = "client_beta@beta.com"
    default_password = await _create_client_user(
        client,
        admin_token_headers,
        company_id=company_b["id"],
        email=client_email,
    )
    client_b_headers = await _login(client, email=client_email, password=default_password)

    pdf_bytes = b"%PDF-1.4\n%%EOF\n"

    upload_resp = await client.post(
        "/api/v1/reports/upload",
        data={
            "project_id": str(project_a["id"]),
            "report_kind": "area",
            "report_date": "2026-02-24",
            "formatted_address": "123 Main St, Testville, TX 00000",
            "google_place_id": "place_123",
        },
        files={"file": ("report.pdf", pdf_bytes, "application/pdf")},
        headers=manager_token_headers,
    )
    assert upload_resp.status_code == status.HTTP_201_CREATED
    report_id = upload_resp.json()["id"]

    dl = await client.get(f"/api/v1/reports/{report_id}/download", headers=client_b_headers)
    assert dl.status_code == status.HTTP_403_FORBIDDEN


async def test_personal_report_requires_worker_name(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
):
    _, project = await _create_company_and_project(client, admin_token_headers)

    pdf_bytes = b"%PDF-1.4\n%%EOF\n"

    upload_resp = await client.post(
        "/api/v1/reports/upload",
        data={
            "project_id": str(project["id"]),
            "report_kind": "personal",
            "report_date": "2026-02-24",
            "formatted_address": "123 Main St, Testville, TX 00000",
            "google_place_id": "place_123",
        },
        files={"file": ("report.pdf", pdf_bytes, "application/pdf")},
        headers=manager_token_headers,
    )
    assert upload_resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


async def test_report_locations_endpoint_lists_prior_locations(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
):
    _, project = await _create_company_and_project(client, admin_token_headers)

    pdf_bytes = b"%PDF-1.4\n%%EOF\n"

    for loc in ("Boiler Room", "Attic"):
        resp = await client.post(
            "/api/v1/reports/upload",
            data={
                "project_id": str(project["id"]),
                "report_kind": "area",
                "report_date": "2026-02-24",
                "formatted_address": "123 Main St, Testville, TX 00000",
                "google_place_id": "place_123",
                "location_label": loc,
            },
            files={"file": ("report.pdf", pdf_bytes, "application/pdf")},
            headers=manager_token_headers,
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.text

    loc_resp = await client.get(
        "/api/v1/reports/locations",
        params={"project_id": project["id"], "google_place_id": "place_123"},
        headers=manager_token_headers,
    )
    assert loc_resp.status_code == status.HTTP_200_OK, loc_resp.text
    assert loc_resp.json() == ["Attic", "Boiler Room"]


async def test_list_reports_company_id_filter_permissions(
    client: AsyncClient,
    admin_token_headers: dict,
    manager_token_headers: dict,
    supervisor_token_headers: dict,
    field_tech_token_headers: dict,
):
    company, project = await _create_company_and_project(client, admin_token_headers)

    client_email = "client_list@acme.com"
    default_password = await _create_client_user(
        client,
        admin_token_headers,
        company_id=company["id"],
        email=client_email,
    )
    client_headers = await _login(client, email=client_email, password=default_password)

    pdf_bytes = b"%PDF-1.4\n%%EOF\n"

    upload_resp = await client.post(
        "/api/v1/reports/upload",
        data={
            "project_id": str(project["id"]),
            "report_kind": "area",
            "report_date": "2026-02-24",
            "formatted_address": "123 Main St, Testville, TX 00000",
            "google_place_id": "place_123",
        },
        files={"file": ("report.pdf", pdf_bytes, "application/pdf")},
        headers=manager_token_headers,
    )
    assert upload_resp.status_code == status.HTTP_201_CREATED, upload_resp.text
    report_id = upload_resp.json()["id"]

    # supervisor+ employees can filter by company_id
    sup_list = await client.get(
        "/api/v1/reports/",
        params={"company_id": company["id"]},
        headers=supervisor_token_headers,
    )
    assert sup_list.status_code == status.HTTP_200_OK, sup_list.text
    assert any(r["id"] == report_id for r in sup_list.json())

    # employees below supervisor cannot filter by company_id
    denied = await client.get(
        "/api/v1/reports/",
        params={"company_id": company["id"]},
        headers=field_tech_token_headers,
    )
    assert denied.status_code == status.HTTP_403_FORBIDDEN

    # Company users do NOT use this listing endpoint (they use /api/v1/reports/client/*).
    # Ensure it remains blocked.
    client_list = await client.get(
        "/api/v1/reports/",
        params={"company_id": company["id"]},
        headers=client_headers,
    )
    assert client_list.status_code == status.HTTP_403_FORBIDDEN
