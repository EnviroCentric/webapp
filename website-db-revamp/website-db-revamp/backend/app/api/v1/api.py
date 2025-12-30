from fastapi import APIRouter
from app.api.v1 import (
    auth, users, roles, 
    projects, samples,
    companies, laboratory, reports
)

api_router = APIRouter()

# Core authentication and user management
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])

# Multi-tenant company management
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])

# Environmental sampling workflow
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(samples.router, prefix="/samples", tags=["samples"])
api_router.include_router(laboratory.router, prefix="/laboratory", tags=["laboratory"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
