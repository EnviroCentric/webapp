from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from asyncpg.pool import Pool

from app.schemas.sample import SampleCreate, SampleUpdate, SampleInDB
from app.db.queries.manager import query_manager
from app.services.roles import get_user_role_level

async def create_sample(
    db: Pool,
    sample: SampleCreate,
    current_user_id: int
) -> SampleInDB:
    """Create a new sample."""
    # Check if user has technician role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher roles can create samples"
        )
    
    # Check if user has access to the visit
    visit = await db.fetchrow(
        "SELECT id, project_id FROM project_visits WHERE id = $1",
        sample.visit_id
    )
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit not found"
        )

    if sample.project_id != visit["project_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="visit_id does not belong to the given project_id",
        )

    # Create the sample with visit-based data
    created_sample = await db.fetchrow(
        query_manager.create_sample,
        sample.project_id,  # project_id
        sample.visit_id,    # visit_id
        current_user_id,    # collected_by
        datetime.now(timezone.utc),  # collected_at
        sample.description,
        sample.is_inside,
        sample.flow_rate,
        sample.volume_required,
        "collected",        # sample_status
        None,               # reject_reason
        sample.cassette_barcode,
    )
    if not created_sample:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create sample"
        )
    
    return SampleInDB(**created_sample)

async def get_sample(
    db: Pool,
    sample_id: int,
    current_user_id: int
) -> SampleInDB:
    """Get a sample by ID."""
    # Check if user has technician role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher roles can view samples"
        )
    
    # Get the sample
    result = await db.fetchrow(query_manager.get_sample, sample_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample not found"
        )
    
    return SampleInDB(**result)

async def update_sample(
    db: Pool,
    sample_id: int,
    sample_update: SampleUpdate,
    current_user_id: int
) -> SampleInDB:
    """Update a sample."""
    # Check if user has technician role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher roles can update samples"
        )
    
    # Update the sample
    result = await db.fetchrow(
        query_manager.update_sample,
        sample_id,
        sample_update.description,
        sample_update.is_inside,
        sample_update.flow_rate,
        sample_update.volume_required,
        sample_update.sample_status,
        sample_update.reject_reason,
        sample_update.cassette_barcode,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample not found"
        )
    
    return SampleInDB(**result)

async def update_sample_barcode(
    db: Pool,
    sample_id: int,
    barcode: str,
    current_user_id: int
) -> SampleInDB:
    """Update only the barcode of a sample."""
    # Check if user has technician role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher roles can update samples"
        )
    
    # Update only the barcode
    result = await db.fetchrow(
        "UPDATE samples SET cassette_barcode = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
        sample_id, barcode
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample not found"
        )
    
    return SampleInDB(**result)

async def delete_sample(
    db: Pool,
    sample_id: int,
    current_user_id: int
) -> None:
    """Delete a sample."""
    # Check if user has supervisor role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 80:  # Supervisor level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher roles can delete samples"
        )
    
    # Delete the sample
    result = await db.execute(query_manager.delete_sample, sample_id)
    if result == "DELETE 0":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample not found"
        )

async def get_samples_by_address(
    db: Pool,
    address_id: int,
    current_user_id: int,
    date: str = None,
) -> List[SampleInDB]:
    """Deprecated: addresses are no longer a first-class table.

    Use visit-based endpoints instead.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Address-scoped samples are deprecated; use /samples/visit/{visit_id}",
    )

async def get_samples_by_visit(
    db: Pool,
    visit_id: int,
    current_user_id: int,
    date: str = None
) -> List[SampleInDB]:
    """Get all samples for a visit, optionally filtered by date."""
    # Check if user has technician role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher roles can view samples"
        )
    # For now, just get all samples for the visit (date filtering can be added later)
    results = await db.fetch(query_manager.get_samples_by_visit, visit_id)
    return [SampleInDB(**result) for result in results]

async def list_samples(
    db: Pool,
    current_user_id: int
) -> List[SampleInDB]:
    """List all samples accessible to the user."""
    # Check if user has technician role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher roles can view samples"
        )
    
    # Get all samples
    results = await db.fetch(query_manager.list_samples)
    return [SampleInDB(**result) for result in results]
