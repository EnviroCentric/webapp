from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException, status
from asyncpg.pool import Pool

from app.schemas.sample import SampleCreate, SampleUpdate, SampleInDB
from app.db.queries import samples as queries
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
    
    # Check if user has access to the address
    address = await db.fetchrow(
        queries.get_address,
        sample.address_id
    )
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )

    # Create the sample
    created_sample = await db.fetchrow(
        queries.create_sample,
        sample.address_id,
        sample.description,
        sample.cassette_barcode,
        sample.flow_rate,
        sample.volume_required
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
    result = await db.fetchrow(queries.get_sample, sample_id)
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
        queries.update_sample,
        sample_id,
        sample_update.description,
        sample_update.is_inside,
        sample_update.flow_rate,
        sample_update.volume_required,
        sample_update.start_time,
        sample_update.stop_time,
        sample_update.fields,
        sample_update.fibers,
        sample_update.cassette_barcode
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
    result = await db.execute(queries.delete_sample, sample_id)
    if result == "DELETE 0":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample not found"
        )

async def get_samples_by_address(
    db: Pool,
    address_id: int,
    current_user_id: int,
    date: str = None
) -> List[SampleInDB]:
    """Get all samples for an address, optionally filtered by date."""
    # Check if user has technician role or higher
    role_level = await get_user_role_level(db, current_user_id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher roles can view samples"
        )
    if date:
        results = await db.fetch(queries.get_samples_by_address_and_date, address_id, date)
    else:
        results = await db.fetch(queries.get_samples_by_address, address_id)
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
    results = await db.fetch(queries.list_samples)
    return [SampleInDB(**result) for result in results] 