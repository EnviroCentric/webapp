from fastapi import APIRouter, Depends, HTTPException, status, Query
from asyncpg.pool import Pool
from datetime import date as date_type, datetime

from app.core.security import get_current_user
from app.db.session import get_db
from app.schemas.sample import SampleCreate, SampleUpdate, SampleInDB
from app.services import samples as sample_service

router = APIRouter(
    prefix="/samples", 
    tags=["Sample Management"],
    responses={403: {"description": "Insufficient permissions"}}
)

@router.post("", response_model=SampleInDB)
@router.post("/", response_model=SampleInDB)
async def create_sample(
    sample: SampleCreate,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new sample. Requires technician role or higher."""
    return await sample_service.create_sample(db, sample, current_user["id"])

@router.get("/{sample_id}", response_model=SampleInDB)
async def get_sample(
    sample_id: int,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a sample by ID. Requires technician role or higher."""
    return await sample_service.get_sample(db, sample_id, current_user["id"])

@router.patch("/{sample_id}", response_model=SampleInDB)
async def update_sample(
    sample_id: int,
    sample_update: SampleUpdate,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a sample. Requires technician role or higher."""
    return await sample_service.update_sample(db, sample_id, sample_update, current_user["id"])

@router.patch("/{sample_id}/barcode", response_model=SampleInDB)
async def update_sample_barcode(
    sample_id: int,
    barcode_data: dict,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update only the barcode of a sample. Used for blank samples."""
    barcode = barcode_data.get("cassette_barcode")
    if not barcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cassette_barcode is required"
        )
    return await sample_service.update_sample_barcode(db, sample_id, barcode, current_user["id"])

@router.delete("/{sample_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sample(
    sample_id: int,
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a sample. Requires technician role or higher."""
    await sample_service.delete_sample(db, sample_id, current_user["id"])

@router.get("/address/{address_id}", response_model=list[SampleInDB])
async def get_samples_by_address(
    address_id: int,
    date: str = Query(None, description="Filter samples by date (YYYY-MM-DD)"),
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all samples for an address. Requires technician role or higher."""
    date_obj = None
    if date:
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date format, should be YYYY-MM-DD")
    return await sample_service.get_samples_by_address(db, address_id, current_user["id"], date_obj)

@router.get("/visit/{visit_id}", response_model=list[SampleInDB])
async def get_samples_by_visit(
    visit_id: int,
    date: str = Query(None, description="Filter samples by date (YYYY-MM-DD)"),
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all samples for a visit. Requires technician role or higher."""
    date_obj = None
    if date:
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date format, should be YYYY-MM-DD")
    return await sample_service.get_samples_by_visit(db, visit_id, current_user["id"], date_obj)

@router.get("", response_model=list[SampleInDB])
@router.get("/", response_model=list[SampleInDB])
async def list_samples(
    db: Pool = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all samples accessible to the current user."""
    return await sample_service.list_samples(db, current_user["id"])
