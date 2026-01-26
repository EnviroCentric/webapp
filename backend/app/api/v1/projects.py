from typing import List, Optional
from datetime import date
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from asyncpg import Pool

from app.core.deps import get_db, get_current_active_user
from app.schemas.user import UserResponse
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectVisitCreate, ProjectVisitUpdate, ProjectVisitResponse
)
from app.services.projects import ProjectService
from app.services.roles import get_user_role_level
from app.services.google_places import get_google_places_service, GooglePlacesService

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Project Management"],
    responses={403: {"description": "Insufficient permissions"}}
)


def get_project_service(db: Pool = Depends(get_db)) -> ProjectService:
    return ProjectService(db)


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Create a new project. Requires supervisor level or above."""
    # Check role permissions
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can create projects"
        )
    
    # Superusers can create projects for any company
    if current_user.is_superuser:
        pass  # No restrictions
    # Client users can only create projects for their own company
    elif current_user.company_id is not None:
        if project_in.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create projects for your own company"
            )
    # Employee users - no company restrictions
    
    return await project_service.create_project(project_in)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Get a project by ID. Access control based on company affiliation and role."""
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check access permissions
    role_level = await get_user_role_level(db, current_user.id)
    
    # Superusers can access any project
    if current_user.is_superuser:
        return project
    
    # Client users can only access projects from their company
    if current_user.company_id is not None:
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access projects from your company"
            )
        return project
    
    # Employee users (company_id is null but not superuser)
    # Managers and above can access any project
    if role_level >= 90:
        return project
    
    # Below manager level - employees can only access projects they are assigned to
    is_assigned = await project_service.check_technician_assigned_to_project(
        project_id, current_user.id
    )
    if not is_assigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access projects you are assigned to"
        )
    
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Update a project. Requires supervisor level or above for the same company."""
    # Check if project exists and get company info
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check role permissions
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can update projects"
        )
    
    # Superusers can update any project
    if current_user.is_superuser:
        pass  # No restrictions
    # Client users can only update projects from their company
    elif current_user.company_id is not None:
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update projects from your company"
            )
    # Employee users - no additional company restrictions beyond role level
    
    updated_project = await project_service.update_project(project_id, project_in)
    if not updated_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return updated_project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Delete a project. Requires supervisor level or above for the same company."""
    # Check if project exists and get company info
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check role permissions
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can delete projects"
        )
    
    # Superusers can delete any project
    if current_user.is_superuser:
        pass  # No restrictions
    # Client users can only delete projects from their company
    elif current_user.company_id is not None:
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete projects from your company"
            )
    # Employee users - no additional company restrictions beyond role level
    
    success = await project_service.delete_project(project_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """List projects based on user's role level and assignments."""
    role_level = await get_user_role_level(db, current_user.id)
    
    # Superusers can see all projects
    if current_user.is_superuser:
        return await project_service.list_projects()
    
    # Client users (with company_id) see only projects from their company
    if current_user.company_id is not None:
        company_projects = await project_service.list_projects_by_company(current_user.company_id)
        return company_projects
    
    # Employee users (company_id is null but not superuser)
    # Managers and above (level 90+) can see all projects
    if role_level >= 90:
        return await project_service.list_projects()
    
    # Below manager level - employees only see projects they are assigned to
    technician_projects = await project_service.list_technician_assigned_projects(current_user.id)
    # Convert to ProjectResponse objects
    return [ProjectResponse(**project) for project in technician_projects]


# Project addresses endpoint (addresses linked through visits)
@router.get("/{project_id}/addresses", response_model=List[dict])
async def get_project_addresses(
    project_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Get all addresses associated with a project through visits."""
    # Check if project exists and user has access
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    role_level = await get_user_role_level(db, current_user.id)
    
    # Access control for viewing project addresses
    if current_user.is_superuser:
        pass  # Superusers can access any project
    elif current_user.company_id is not None:
        # Client users can only access projects from their company
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access projects from your company"
            )
    else:
        # Employee users - managers can access any project
        if role_level < 90:  # Below manager level
            # Employees must be assigned to the project
            is_assigned = await project_service.check_technician_assigned_to_project(
                project_id, current_user.id
            )
            if not is_assigned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only access projects you are assigned to"
                )
    
    return await project_service.get_project_addresses(project_id)


@router.get("/{project_id}/technicians", response_model=List[dict])
async def get_project_technicians(
    project_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Get all technicians assigned to a project through visits."""
    # Check if project exists and user has access
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    role_level = await get_user_role_level(db, current_user.id)
    
    # Access control for viewing project technicians
    if current_user.is_superuser:
        pass  # Superusers can access any project
    elif current_user.company_id is not None:
        # Client users can only access projects from their company
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access projects from your company"
            )
    else:
        # Employee users - managers can access any project
        if role_level < 90:  # Below manager level
            # Employees must be assigned to the project
            is_assigned = await project_service.check_technician_assigned_to_project(
                project_id, current_user.id
            )
            if not is_assigned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only access projects you are assigned to"
                )
    
    return await project_service.get_project_technicians(project_id)


# Address validation endpoints
@router.post("/addresses/validate", response_model=dict)
async def validate_address(
    address_data: dict,
    current_user: UserResponse = Depends(get_current_active_user),
    places_service: GooglePlacesService = Depends(get_google_places_service),
    db: Pool = Depends(get_db)
):
    """Validate and enrich address data using Google Places API. Requires technician level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher can validate addresses"
        )
    
    try:
        validated_data = await places_service.validate_and_enrich_address(address_data)
        return {
            "success": True,
            "data": validated_data
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "data": address_data  # Return original data as fallback
        }


@router.post("/addresses/geocode", response_model=dict)
async def geocode_address(
    address_text: str,
    current_user: UserResponse = Depends(get_current_active_user),
    places_service: GooglePlacesService = Depends(get_google_places_service),
    db: Pool = Depends(get_db)
):
    """Geocode an address text to coordinates. Requires technician level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher can geocode addresses"
        )
    
    try:
        result = await places_service.geocode_address(address_text)
        if result:
            return {
                "success": True,
                "data": result
            }
        else:
            return {
                "success": False,
                "error": "Address not found or could not be geocoded"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# Project visit endpoints
@router.post("/{project_id}/visits", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_project_visit(
    project_id: int,
    visit_in: ProjectVisitCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Create a project visit. Requires technician level or above with project access."""
    # Validate project_id matches the visit data
    if visit_in.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project ID in URL must match project ID in request body"
        )
    
    # Check if project exists and user has access
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher can create project visits"
        )
    
    # Access control for project visits
    if current_user.is_superuser:
        pass  # Superusers can create visits for any project
    elif current_user.company_id is not None:
        # Client users can only create visits for projects from their company
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create visits for projects from your company"
            )
    else:
        # Employee users - managers can create visits for any project
        if role_level < 90:  # Below manager level
            # Employees must be assigned to the project
            is_assigned = await project_service.check_technician_assigned_to_project(
                project_id, current_user.id
            )
            if not is_assigned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only create visits for projects you are assigned to"
                )
    
    return await project_service.create_project_visit(visit_in)


@router.get("/{project_id}/visits", response_model=List[dict])
async def get_project_visits(
    project_id: int,
    visit_date: Optional[date] = Query(None, description="Filter by visit date"),
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Get all visits for a project, optionally filtered by date."""
    # Check if project exists and user has access
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    role_level = await get_user_role_level(db, current_user.id)
    
    # Access control for viewing project visits
    if current_user.is_superuser:
        pass  # Superusers can access visits for any project
    elif current_user.company_id is not None:
        # Client users can only access visits for projects from their company
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access visits for projects from your company"
            )
    else:
        # Employee users - managers can access visits for any project
        if role_level < 90:  # Below manager level
            # Employees must be assigned to the project
            is_assigned = await project_service.check_technician_assigned_to_project(
                project_id, current_user.id
            )
            if not is_assigned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only access visits for projects you are assigned to"
                )
    
    if visit_date:
        return await project_service.get_project_visits_by_date(project_id, visit_date)
    else:
        return await project_service.get_project_visits(project_id)


@router.post("/{project_id}/addresses", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_project_address(
    project_id: int,
    visit_in: ProjectVisitCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    places_service: GooglePlacesService = Depends(get_google_places_service),
    db: Pool = Depends(get_db)
):
    """Create a project visit with embedded address data. Field techs (50+) and managers (90+) only."""
    # Validate project_id matches the visit data
    if visit_in.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project ID in URL must match project ID in request body"
        )
    
    # Check if project exists and user has access
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    role_level = await get_user_role_level(db, current_user.id)
    
    # Special permission logic: Field techs (50+) and managers (90+) only
    # Excludes supervisors (80) and lab techs (60)
    if not (role_level >= 50 and (role_level < 60 or role_level >= 90)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only field technicians and managers can add addresses to projects"
        )
    
    # Access control for creating project visits with addresses
    if current_user.is_superuser:
        pass  # Superusers can create visits for any project
    elif current_user.company_id is not None:
        # Client users can only create visits for projects from their company
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create visits for projects from your company"
            )
    else:
        # Employee users - managers can create visits for any project
        if role_level < 90:  # Below manager level
            # Field techs must be assigned to the project
            is_assigned = await project_service.check_technician_assigned_to_project(
                project_id, current_user.id
            )
            if not is_assigned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only create visits for projects you are assigned to"
                )
    
    # Validate and enrich address data if Google Places data is available
    try:
        visit_dict = visit_in.model_dump()
        if any([visit_dict.get('address_line1'), visit_dict.get('formatted_address')]):
            validated_data = await places_service.validate_and_enrich_address(visit_dict)
            # Update the visit_in with validated data
            for key, value in validated_data.items():
                if hasattr(visit_in, key) and value is not None:
                    setattr(visit_in, key, value)
    except Exception as e:
        # Log the error but don't fail the creation
        logger.warning(f"Address validation failed: {e}")
    
    # Create project visit with embedded address data
    visit = await project_service.create_project_visit(visit_in)
    
    return {
        "visit": visit,
        "message": "Address added to project successfully"
    }


@router.post("/{project_id}/technicians", status_code=status.HTTP_201_CREATED)
async def assign_technician_to_project(
    project_id: int,
    technician_data: dict,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Assign a technician to a project. Requires manager level or above."""
    # Check if project exists and user has access
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can assign technicians"
        )
    
    # Access control for assigning technicians
    if current_user.is_superuser:
        pass  # Superusers can assign technicians to any project
    elif current_user.company_id is not None:
        # Client users can only assign technicians to projects from their company
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only assign technicians to projects from your company"
            )
    # Employee users - no additional company restrictions beyond role level
    
    technician_id = technician_data.get("user_id") or technician_data.get("technician_id")
    if not technician_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing technician ID (use 'user_id' or 'technician_id')"
        )
    
    # Verify the technician exists and has appropriate role level
    async with db.acquire() as conn:
        technician = await conn.fetchrow(
            "SELECT id, highest_level FROM users WHERE id = $1",
            technician_id
        )
        if not technician:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Technician not found"
            )
        if technician["highest_level"] < 50:  # Must be at least field tech level
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have technician level or higher to be assigned to projects"
            )
    
    result = await project_service.assign_technician_to_project(
        project_id, technician_id, current_user.id
    )
    
    if result:
        return {"message": "Technician assigned successfully", "assignment": result}
    else:
        return {"message": "Technician was already assigned to this project"}


@router.delete("/{project_id}/technicians/{technician_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_technician_from_project(
    project_id: int,
    technician_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
    db: Pool = Depends(get_db)
):
    """Remove a technician's assignment from a project. Requires manager level or above."""
    # Check if project exists and user has access
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can unassign technicians"
        )
    
    # Access control for unassigning technicians
    if current_user.is_superuser:
        pass  # Superusers can unassign technicians from any project
    elif current_user.company_id is not None:
        # Client users can only unassign technicians from projects in their company
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only unassign technicians from projects in your company"
            )
    # Employee users - no additional company restrictions beyond role level
    
    success = await project_service.unassign_technician_from_project(project_id, technician_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician assignment not found"
        )


