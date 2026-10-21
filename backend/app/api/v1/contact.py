"""Public service requests delivered to the company inbox through SES."""
import logging
from typing import Literal

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.config import settings

router = APIRouter(tags=["Contact"])
logger = logging.getLogger(__name__)
RECIPIENT = "info@enviro-centric.com"


class ContactRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    firstName: str = Field(min_length=1, max_length=100)
    lastName: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=254)
    countryCode: Literal["+1", "+44", "+61", "other"] = "+1"
    phone: str = Field(default="", max_length=40)
    details: str = Field(default="", max_length=5000)
    clientType: Literal["Home Owner", "Realtor", "Restoration Company", "Property Manager", "Insurance Company", "Other"]
    referral: Literal["Search engine", "Referral", "Social media", "Returning client", "Other"]
    communicationsConsent: Literal["yes"] | None = None
    website: str = Field(default="", max_length=200)


@router.post("/contact", status_code=200)
def submit_contact(data: ContactRequest):
    # Quietly discard automated submissions to the hidden honeypot.
    if data.website:
        return {"status": "submitted"}
    body = "\n".join([
        "New website service request", "",
        f"Name: {data.firstName} {data.lastName}",
        f"Email: {data.email}",
        f"Phone: {data.countryCode} {data.phone}" if data.phone else "Phone: Not provided",
        f"Client type: {data.clientType}", f"Referral: {data.referral}",
        f"Communications consent: {'Yes' if data.communicationsConsent else 'No'}",
        "", "Project details:", data.details or "Not provided",
    ])
    try:
        client = boto3.client("ses", region_name=settings.AWS_REGION,
                              config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 0}))
        client.send_email(
            Source=RECIPIENT,
            Destination={"ToAddresses": [RECIPIENT]},
            ReplyToAddresses=[str(data.email)],
            Message={
                "Subject": {"Data": "Website service request", "Charset": "UTF-8"},
                "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
            },
        )
    except (BotoCoreError, ClientError):
        logger.exception("SES could not deliver website service request")
        raise HTTPException(status_code=503, detail="Email delivery is unavailable. Please try again or call (714) 335-5973.")
    return {"status": "submitted"}
