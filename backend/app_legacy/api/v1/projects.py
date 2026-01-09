from fastapi import APIRouter, Depends, HTTPException, status, Query
from asyncpg.pool import Pool
from typing import List, Optional
from datetime import date

from app.core.security import get_current_user
from app.db.session import get_db
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectInDB, ProjectWithAddresses,
    AddressCreate, AddressUpdate, AddressInDB,
    ProjectTechnicianAssign, ProjectTechnicianRemove
)
from app.schemas.user import UserInDB
from app.services import projects as project_service

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectInDB)
async def create_project(
    project: ProjectCreate,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new project. Requires technician role or higher."""
    return await project_service.create_project(db, project, current_user["id"])

@router.get("/{project_id}", response_model=ProjectWithAddresses)
async def get_project(
    project_id: int,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a project by ID. Requires technician role or higher."""
    return await project_service.get_project(db, project_id, current_user["id"])

@router.patch("/{project_id}", response_model=ProjectInDB)
async def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a project. Requires technician role or higher."""
    return await project_service.update_project(db, project_id, project_update, current_user["id"])

@router.post("/{project_id}/addresses", response_model=AddressInDB)
async def create_address(
    project_id: int,
    address: AddressCreate,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add an address to a project. Requires technician role or higher."""
    return await project_service.create_address(db, project_id, address, current_user["id"])

@router.patch("/{project_id}/addresses/{address_id}", response_model=AddressInDB)
async def update_address(
    project_id: int,
    address_id: int,
    address_update: AddressUpdate,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update an address. Requires technician role or higher."""
    return await project_service.update_address(db, project_id, address_id, address_update, current_user["id"])

@router.post("/{project_id}/technicians", status_code=status.HTTP_204_NO_CONTENT)
async def assign_technician(
    project_id: int,
    technician: ProjectTechnicianAssign,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Assign a technician to a project. Requires supervisor role or higher."""
    await project_service.assign_technician(db, project_id, technician.user_id, current_user["id"])

@router.delete("/{project_id}/technicians/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_technician(
    project_id: int,
    user_id: int,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Remove a technician from a project. Requires supervisor role or higher."""
    await project_service.remove_technician(db, project_id, user_id, current_user["id"])

@router.get("/{project_id}/technicians", response_model=list[UserInDB])
async def get_project_technicians(
    project_id: int,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all technicians assigned to a project. Requires technician role or higher."""
    return await project_service.get_project_technicians(db, project_id, current_user["id"])

@router.get("/", response_model=list[ProjectInDB])
async def list_projects(
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all projects accessible to the current user."""
    return await project_service.list_projects(db, current_user["id"])

@router.get("/{project_id}/addresses", response_model=List[AddressInDB])
async def get_addresses_for_date(
    project_id: int,
    date: Optional[date] = Query(None),
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get addresses for a project, optionally filtered by date."""
    addresses = await project_service.get_addresses_for_project(db, project_id, date, current_user["id"])
    return addresses

@router.get("/{project_id}/addresses/{address_id}", response_model=AddressInDB)
async def get_address(
    project_id: int,
    address_id: int,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a single address by ID. Requires technician role or higher."""
    return await project_service.get_address(db, project_id, address_id, current_user["id"]) 