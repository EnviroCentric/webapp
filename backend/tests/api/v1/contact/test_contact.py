import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from unittest.mock import Mock
from botocore.exceptions import ClientError
from app.api.v1 import contact

@pytest.mark.asyncio
@pytest.mark.parametrize("scenario", ["success", "failure", "invalid", "missing", "honeypot"])
async def test_contact_delivery(scenario, monkeypatch):
    """Validate public submissions, recipient/reply-to, failures and bot rejection without sending mail."""
    app = FastAPI()
    app.include_router(contact.router, prefix="/api/v1")
    client = Mock()
    monkeypatch.setattr(contact.boto3, "client", Mock(return_value=client))
    data = dict(firstName="Alex", lastName="Smith", email="alex@example.com", clientType="Home Owner", referral="Referral", details="Survey requested")
    if scenario == "failure":
        client.send_email.side_effect = ClientError({"Error": {"Code": "MessageRejected", "Message": "Unverified"}}, "SendEmail")
    elif scenario == "invalid":
        data["email"] = "invalid"
    elif scenario == "missing":
        del data["firstName"]
    elif scenario == "honeypot":
        data["website"] = "spam.example"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        response = await http.post("/api/v1/contact", json=data)
    expected = {"success": 200, "failure": 503, "invalid": 422, "missing": 422, "honeypot": 200}[scenario]
    assert response.status_code == expected
    if scenario == "success":
        sent = client.send_email.call_args.kwargs
        assert sent["Destination"] == {"ToAddresses": ["info@enviro-centric.com"]}
        assert sent["ReplyToAddresses"] == ["alex@example.com"]
        assert "Survey requested" in sent["Message"]["Body"]["Text"]["Data"]
        assert response.json() == {"status": "submitted"}
    elif scenario != "failure":
        client.send_email.assert_not_called()
