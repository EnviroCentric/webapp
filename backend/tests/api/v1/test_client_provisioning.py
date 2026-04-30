import pytest
from httpx import AsyncClient
from fastapi import status

pytestmark = pytest.mark.asyncio


async def test_admin_can_create_client_and_client_must_change_password(
    client: AsyncClient,
    admin_token_headers: dict,
):
    # Create company
    company_resp = await client.post(
        "/api/v1/companies/",
        json={"name": "acme"},
        headers=admin_token_headers,
    )
    assert company_resp.status_code == status.HTTP_201_CREATED, company_resp.text
    company = company_resp.json()

    # Provision client account
    provision_resp = await client.post(
        "/api/v1/users/client",
        json={
            "company_id": company["id"],
            "email": "client1@acme.com",
            "first_name": "Client",
            "last_name": "One",
            "code": "1234",
        },
        headers=admin_token_headers,
    )
    assert provision_resp.status_code == status.HTTP_201_CREATED, provision_resp.text
    body = provision_resp.json()

    assert "default_password" in body
    assert body["default_password"].endswith("!1234")
    assert body["user"]["email"] == "client1@acme.com"
    assert body["user"]["company_id"] == company["id"]
    assert body["user"]["must_change_password"] is True

    # Client can login with default password
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "client1@acme.com",
            "password": body["default_password"],
        },
    )
    assert login_resp.status_code == status.HTTP_200_OK, login_resp.text
    tokens = login_resp.json()
    assert "access_token" in tokens

    client_headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # must_change_password is visible on /auth/me
    me_resp = await client.get("/api/v1/auth/me", headers=client_headers)
    assert me_resp.status_code == status.HTTP_200_OK
    assert me_resp.json()["must_change_password"] is True

    # Change password
    pw_resp = await client.put(
        "/api/v1/users/me/password",
        json={
            "current_password": body["default_password"],
            "new_password": "NewPass123!@#",
        },
        headers=client_headers,
    )
    assert pw_resp.status_code == status.HTTP_200_OK, pw_resp.text

    # must_change_password should now be false
    me2_resp = await client.get("/api/v1/auth/me", headers=client_headers)
    assert me2_resp.status_code == status.HTTP_200_OK
    assert me2_resp.json()["must_change_password"] is False
