from datetime import date
from typing import List, Optional
from fastapi import HTTPException, status
from asyncpg.pool import Pool

from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectInDB, ProjectWithAddresses,
    AddressCreate, AddressUpdate, AddressInDB
)
from app.schemas.user import UserInDB
from app.db.queries import projects as queries
from app.services.roles import get_user_role_level

async def create_project(
    db: Pool,
    project: ProjectCreate,
    current_user_id: int
) -> ProjectInDB:
    # Check if user has technician role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher roles can create projects"
        )
    
    # Create the project
    result = await db.fetchrow(queries.create_project, project.name)
    project_id = result["id"]
    
    # Assign technicians if provided
    if project.technicians:
        # Check if current user has supervisor role or higher
        if role_level < 80:  # Supervisor level
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only supervisors and higher can assign technicians"
            )
        
        # Assign each technician
        for user_id in project.technicians:
            # Check if target user has technician role
            target_role_level = await get_user_role_level(db, user_id)
            if target_role_level < 50:  # Technician level
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User {user_id} must be a technician or higher"
                )
            
            await db.execute(
                queries.assign_technician,
                project_id, user_id
            )
    
    return ProjectInDB(**result)

async def get_project(
    db: Pool,
    project_id: int,
    current_user_id: int
) -> ProjectWithAddresses:
    # First check if project exists
    project = await db.fetchrow(queries.get_project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Then check if user has access to the project
    is_assigned = await db.fetchval(
        queries.check_technician_assigned,
        project_id, current_user_id
    )
    role_level = await get_user_role_level(db, current_user_id)
    
    # Only allow access if user is assigned to project or has supervisor role or higher
    if not is_assigned and role_level < 80:  # Supervisor level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )
    
    # Get addresses
    addresses = await db.fetch(
        queries.get_project_addresses,
        project_id
    )
    addresses = [AddressInDB(**addr) for addr in addresses]
    
    return ProjectWithAddresses(**project, addresses=addresses)

async def update_project(
    db: Pool,
    project_id: int,
    project_update: ProjectUpdate,
    current_user_id: int
) -> ProjectInDB:
    # Check if user has access to the project
    is_assigned = await db.fetchval(
        queries.check_technician_assigned,
        project_id, current_user_id
    )
    role_level = await get_user_role_level(db, current_user_id)
    
    if not is_assigned and role_level < 50:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )
    
    updated_project = await db.fetchrow(
        queries.update_project,
        project_id, project_update.name
    )
    if not updated_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return ProjectInDB(**updated_project)

async def create_address(
    db: Pool,
    project_id: int,
    address: AddressCreate,
    current_user_id: int
) -> AddressInDB:
    # Check if user has access to the project
    is_assigned = await db.fetchval(
        queries.check_technician_assigned,
        project_id, current_user_id
    )
    role_level = await get_user_role_level(db, current_user_id)
    
    if not is_assigned and role_level < 50:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )
    
    try:
        new_address = await db.fetchrow(
            queries.create_address,
            address.name, address.date
        )
        
        # Add address to project
        await db.execute(
            queries.add_address_to_project,
            project_id, new_address["id"]
        )
        
        return AddressInDB(**new_address)
    except Exception as e:
        if "unique_address_per_day" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An address with this name already exists for this date"
            )
        raise

async def update_address(
    db: Pool,
    project_id: int,
    address_id: int,
    address_update: AddressUpdate,
    current_user_id: int
) -> AddressInDB:
    # Check if user has access to the project
    is_assigned = await db.fetchval(
        queries.check_technician_assigned,
        project_id, current_user_id
    )
    role_level = await get_user_role_level(db, current_user_id)
    
    if not is_assigned and role_level < 50:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )
    
    try:
        # Get current address to preserve the date
        current_address = await db.fetchrow(
            queries.get_address,
            address_id
        )
        if not current_address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Address not found"
            )
        
        # Update only the name, keeping the original date
        updated_address = await db.fetchrow(
            queries.update_address,
            address_id, address_update.name, current_address["date"]
        )
        if not updated_address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Address not found"
            )
        
        return AddressInDB(**updated_address)
    except Exception as e:
        if "unique_address_per_day" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An address with this name already exists for this date"
            )
        raise

async def assign_technician(
    db: Pool,
    project_id: int,
    user_id: int,
    current_user_id: int
) -> None:
    # Check if current user has supervisor role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 80:  # Supervisor level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can assign technicians"
        )
    
    # Check if target user has technician role
    target_role_level = await get_user_role_level(db, user_id)
    if target_role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be a technician or higher"
        )
    
    await db.execute(
        queries.assign_technician,
        project_id, user_id
    )

async def remove_technician(
    db: Pool,
    project_id: int,
    user_id: int,
    current_user_id: int
) -> None:
    # Check if current user has supervisor role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 80:  # Supervisor level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can remove technicians"
        )
    
    # Check if technician is assigned to the project
    is_assigned = await db.fetchval(
        queries.check_technician_assigned,
        project_id, user_id
    )
    if not is_assigned:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician is not assigned to this project"
        )
    
    await db.execute(
        queries.remove_technician,
        project_id, user_id
    )

async def list_projects(
    db: Pool,
    current_user_id: int
) -> List[ProjectInDB]:
    """List all projects accessible to the user."""
    role_level = await get_user_role_level(db, current_user_id)
    
    if role_level >= 80:  # Supervisor or higher can see all projects
        projects = await db.fetch(queries.list_projects)
    else:
        # Regular users can only see their assigned projects
        projects = await db.fetch(queries.list_technician_projects, current_user_id)
    
    return [ProjectInDB(**project) for project in projects]

async def get_project_technicians(
    db: Pool,
    project_id: int,
    current_user_id: int
) -> List[UserInDB]:
    """Get all technicians assigned to a project."""
    # Check if user has access to the project
    is_assigned = await db.fetchval(
        queries.check_technician_assigned,
        project_id, current_user_id
    )
    role_level = await get_user_role_level(db, current_user_id)
    
    if not is_assigned and role_level < 50:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )
    
    # Get all technicians assigned to the project
    technicians = await db.fetch(
        queries.get_project_technicians,
        project_id
    )
    
    return [UserInDB(**tech) for tech in technicians]

async def get_projects(
    db: Pool,
    current_user_id: int,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None
) -> List[ProjectInDB]:
    """Get all projects with optional filtering and sorting."""
    # Check if user has access to view projects
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view projects"
        )

    # For technicians, only show their assigned projects
    if role_level < 80:  # Supervisor level
        projects = await db.fetch(queries.list_technician_projects, current_user_id)
    else:
        # Supervisors and higher can see all projects
        projects = await db.fetch(queries.list_projects)

    # Apply search filter if provided
    if search:
        search_term = f"%{search}%"
        projects = [
            p for p in projects 
            if search_term.lower() in p["name"].lower()
        ]

    # Apply status filter if provided
    if status:
        projects = [p for p in projects if p["status"] == status]

    # Apply sorting if provided
    if sort_by:
        if sort_by not in ["name", "created_at", "status"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid sort field. Must be one of: name, created_at, status"
            )
        
        reverse = sort_order and sort_order.lower() == "desc"
        projects.sort(
            key=lambda x: x[sort_by],
            reverse=reverse
        )
    else:
        # Default sorting by created_at desc
        projects.sort(
            key=lambda x: x["created_at"],
            reverse=True
        )

    # Apply pagination
    projects = projects[skip:skip + limit]

    return [ProjectInDB(**project) for project in projects]

async def get_addresses_for_project(db: Pool, project_id: int, date: Optional[date], current_user_id: int) -> List[AddressInDB]:
    # Check access as in get_project
    is_assigned = await db.fetchval(
        queries.check_technician_assigned,
        project_id, current_user_id
    )
    role_level = await get_user_role_level(db, current_user_id)
    
    if not is_assigned and role_level < 80:  # Supervisor level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )
    
    # Get addresses for the project
    addresses = await db.fetch(
        queries.get_project_addresses,
        project_id
    )
    
    # Filter by date if provided
    if date:
        addresses = [addr for addr in addresses if addr["date"] == date]
    
    return [AddressInDB(**addr) for addr in addresses]

async def get_address(
    db: Pool,
    project_id: int,
    address_id: int,
    current_user_id: int
) -> AddressInDB:
    """Get a single address by ID. Requires technician role or higher."""
    # Check if user has access to the project
    is_assigned = await db.fetchval(
        queries.check_technician_assigned,
        project_id, current_user_id
    )
    role_level = await get_user_role_level(db, current_user_id)
    
    if not is_assigned and role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )
    
    # Get the address
    address = await db.fetchrow(
        queries.get_address,
        address_id
    )
    
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )
    
    # Verify the address belongs to the project
    is_project_address = await db.fetchval(
        queries.check_address_in_project,
        project_id, address_id
    )
    
    if not is_project_address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found in this project"
        )
    
    return AddressInDB(**address) 