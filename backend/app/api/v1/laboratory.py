from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from asyncpg import Pool

from app.core.deps import get_db, get_current_active_user
from app.schemas.user import UserResponse
from app.schemas.laboratory import (
    # Sample schemas
    SampleCreate, SampleUpdate, SampleResponse, SampleStatus,
    # Batch schemas
    SampleBatchCreate, SampleBatchUpdate, SampleBatchResponse,
    BatchSampleAssign, BatchSampleRemove, BatchStatus,
    # Analysis run schemas
    AnalysisRunCreate, AnalysisRunUpdate, AnalysisRunResponse,
    RunSampleAssign, AnalysisRunStatus,
    # Analysis result schemas
    AnalysisResultCreate, AnalysisResultUpdate, AnalysisResultResponse,
    # QA schemas
    QAReviewCreate, QAReviewUpdate, QAReviewResponse, QAStatus,
    # Method schemas
    MethodCreate, MethodUpdate, MethodResponse,
    # Dashboard
    LabDashboardResponse
)
from app.services.laboratory import LabService
from app.services.roles import get_user_role_level

router = APIRouter(
    tags=["Laboratory Workflow"],
    responses={403: {"description": "Insufficient permissions"}}
)


def get_lab_service(db: Pool = Depends(get_db)) -> LabService:
    return LabService(db)


# Sample endpoints
@router.post("/samples", response_model=SampleResponse, status_code=status.HTTP_201_CREATED)
async def create_sample(
    sample_in: SampleCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Create a new sample. Requires technician level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher can create samples"
        )
    
    return await lab_service.create_sample(sample_in)


@router.get("/samples/{sample_id}", response_model=SampleResponse)
async def get_sample(
    sample_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get a sample by ID. Company users can only access samples from their company."""
    sample = await lab_service.get_sample_by_id(sample_id)
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample not found"
        )
    
    # Company-based access control would require checking the project's company
    # For now, basic role check
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view samples"
        )
    
    return sample


@router.put("/samples/{sample_id}", response_model=SampleResponse)
async def update_sample(
    sample_id: int,
    sample_in: SampleUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Update a sample. Requires technician level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher can update samples"
        )
    
    updated_sample = await lab_service.update_sample(sample_id, sample_in)
    if not updated_sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample not found"
        )
    
    return updated_sample


@router.get("/samples", response_model=List[SampleResponse])
async def list_samples(
    status_filter: Optional[SampleStatus] = Query(None, alias="status"),
    unassigned_only: Optional[bool] = Query(False, description="Show only unassigned samples"),
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """List samples with optional filtering. Requires technician level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view samples"
        )
    
    if unassigned_only:
        return await lab_service.get_unassigned_samples()
    elif status_filter:
        return await lab_service.get_samples_by_status(status_filter)
    else:
        return await lab_service.list_samples()


@router.patch("/samples/{sample_id}/status")
async def update_sample_status(
    sample_id: int,
    new_status: SampleStatus,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Update sample status. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can update sample status"
        )
    
    updated_sample = await lab_service.update_sample_status(sample_id, new_status)
    if not updated_sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample not found"
        )
    
    return updated_sample


# Sample Batch endpoints
@router.post("/batches", response_model=SampleBatchResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    batch_in: SampleBatchCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Create a new sample batch. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can create batches"
        )
    
    return await lab_service.create_sample_batch(batch_in)


@router.get("/batches/{batch_id}", response_model=SampleBatchResponse)
async def get_batch(
    batch_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get a batch by ID."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view batches"
        )
    
    batch = await lab_service.get_batch_by_id(batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found"
        )
    
    return batch


@router.put("/batches/{batch_id}", response_model=SampleBatchResponse)
async def update_batch(
    batch_id: int,
    batch_in: SampleBatchUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Update a batch. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can update batches"
        )
    
    updated_batch = await lab_service.update_batch(batch_id, batch_in)
    if not updated_batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found"
        )
    
    return updated_batch


@router.get("/batches", response_model=List[SampleBatchResponse])
async def list_batches(
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """List all batches."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view batches"
        )
    
    return await lab_service.list_batches()


@router.get("/batches/{batch_id}/samples", response_model=List[SampleResponse])
async def get_batch_samples(
    batch_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get all samples in a batch."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view batch samples"
        )
    
    return await lab_service.get_batch_samples(batch_id)


@router.post("/batches/{batch_id}/samples", response_model=List[SampleResponse])
async def assign_samples_to_batch(
    batch_id: int,
    assign: BatchSampleAssign,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Assign samples to a batch. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can assign samples to batches"
        )
    
    return await lab_service.assign_samples_to_batch(batch_id, assign)


@router.delete("/batches/{batch_id}/samples", response_model=List[SampleResponse])
async def remove_samples_from_batch(
    batch_id: int,
    remove: BatchSampleRemove,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Remove samples from a batch. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can remove samples from batches"
        )
    
    return await lab_service.remove_samples_from_batch(batch_id, remove)


# Analysis Run endpoints
@router.post("/runs", response_model=AnalysisRunResponse, status_code=status.HTTP_201_CREATED)
async def create_analysis_run(
    run_in: AnalysisRunCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Create a new analysis run. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can create analysis runs"
        )
    
    return await lab_service.create_analysis_run(run_in)


@router.get("/runs/{run_id}", response_model=AnalysisRunResponse)
async def get_analysis_run(
    run_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get an analysis run by ID."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view analysis runs"
        )
    
    run = await lab_service.get_analysis_run_by_id(run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis run not found"
        )
    
    return run


@router.put("/runs/{run_id}", response_model=AnalysisRunResponse)
async def update_analysis_run(
    run_id: int,
    run_in: AnalysisRunUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Update an analysis run. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can update analysis runs"
        )
    
    updated_run = await lab_service.update_analysis_run(run_id, run_in)
    if not updated_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis run not found"
        )
    
    return updated_run


@router.get("/runs", response_model=List[AnalysisRunResponse])
async def list_analysis_runs(
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """List all analysis runs."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view analysis runs"
        )
    
    return await lab_service.list_analysis_runs()


@router.get("/batches/{batch_id}/runs", response_model=List[AnalysisRunResponse])
async def get_runs_by_batch(
    batch_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get all analysis runs for a batch."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view analysis runs"
        )
    
    return await lab_service.get_runs_by_batch(batch_id)


@router.get("/runs/{run_id}/samples", response_model=List[SampleResponse])
async def get_run_samples(
    run_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get all samples in an analysis run."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view run samples"
        )
    
    return await lab_service.get_run_samples(run_id)


@router.post("/runs/{run_id}/samples")
async def assign_samples_to_run(
    run_id: int,
    assign: RunSampleAssign,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Assign samples to an analysis run. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can assign samples to runs"
        )
    
    return await lab_service.assign_samples_to_run(run_id, assign)


# Analysis Results endpoints
@router.post("/results", response_model=AnalysisResultResponse, status_code=status.HTTP_201_CREATED)
async def create_analysis_result(
    result_in: AnalysisResultCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Create an analysis result. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can create analysis results"
        )
    
    return await lab_service.create_analysis_result(result_in)


@router.get("/results/{result_id}", response_model=AnalysisResultResponse)
async def get_analysis_result(
    result_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get an analysis result by ID."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view analysis results"
        )
    
    result = await lab_service.get_analysis_result_by_id(result_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis result not found"
        )
    
    return result


@router.put("/results/{result_id}", response_model=AnalysisResultResponse)
async def update_analysis_result(
    result_id: int,
    result_in: AnalysisResultUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Update an analysis result. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can update analysis results"
        )
    
    updated_result = await lab_service.update_analysis_result(result_id, result_in)
    if not updated_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis result not found"
        )
    
    return updated_result


@router.get("/runs/{run_id}/results", response_model=List[AnalysisResultResponse])
async def get_results_by_run(
    run_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get all results for an analysis run."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view analysis results"
        )
    
    return await lab_service.get_results_by_run(run_id)


@router.get("/samples/{sample_id}/results", response_model=List[AnalysisResultResponse])
async def get_results_by_sample(
    sample_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get all results for a sample."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view analysis results"
        )
    
    return await lab_service.get_results_by_sample(sample_id)


# QA Review endpoints

# Permission dependency to check supervisor level before request validation
async def require_supervisor_permission(
    current_user: UserResponse = Depends(get_current_active_user),
    db: Pool = Depends(get_db)
) -> UserResponse:
    """Dependency that checks if user has supervisor level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can create QA reviews"
        )
    return current_user

@router.post("/qa-reviews", response_model=QAReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_qa_review(
    review_in: QAReviewCreate,
    current_user: UserResponse = Depends(require_supervisor_permission),
    lab_service: LabService = Depends(get_lab_service)
):
    """Create a QA review. Requires supervisor level or above."""
    return await lab_service.create_qa_review(review_in)


@router.get("/qa-reviews/{review_id}", response_model=QAReviewResponse)
async def get_qa_review(
    review_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get a QA review by ID."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view QA reviews"
        )
    
    review = await lab_service.get_qa_review_by_id(review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QA review not found"
        )
    
    return review


@router.put("/qa-reviews/{review_id}", response_model=QAReviewResponse)
async def update_qa_review(
    review_id: int,
    review_in: QAReviewUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Update a QA review. Requires supervisor level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can update QA reviews"
        )
    
    updated_review = await lab_service.update_qa_review(review_id, review_in)
    if not updated_review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QA review not found"
        )
    
    return updated_review


@router.get("/qa-reviews", response_model=List[QAReviewResponse])
async def list_pending_qa_reviews(
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """List all pending QA reviews."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view QA reviews"
        )
    
    return await lab_service.list_pending_qa_reviews()


@router.get("/qa-reviews/item/{item_type}/{item_id}", response_model=List[QAReviewResponse])
async def get_qa_reviews_by_item(
    item_type: str,
    item_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get all QA reviews for a specific item."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view QA reviews"
        )
    
    return await lab_service.get_qa_reviews_by_item(item_type, item_id)


# Methods endpoints
@router.post("/methods", response_model=MethodResponse, status_code=status.HTTP_201_CREATED)
async def create_method(
    method_in: MethodCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Create a new analysis method. Requires administrator level."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 100:  # Administrator level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create analysis methods"
        )
    
    return await lab_service.create_method(method_in)


@router.get("/methods/{method_id}", response_model=MethodResponse)
async def get_method(
    method_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get an analysis method by ID."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view methods"
        )
    
    method = await lab_service.get_method_by_id(method_id)
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis method not found"
        )
    
    return method


@router.put("/methods/{method_id}", response_model=MethodResponse)
async def update_method(
    method_id: int,
    method_in: MethodUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Update an analysis method. Requires administrator level."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 100:  # Administrator level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update analysis methods"
        )
    
    updated_method = await lab_service.update_method(method_id, method_in)
    if not updated_method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis method not found"
        )
    
    return updated_method


@router.get("/methods", response_model=List[MethodResponse])
async def list_methods(
    include_inactive: bool = Query(False, description="Include inactive methods"),
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """List analysis methods."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view methods"
        )
    
    return await lab_service.list_methods(include_inactive=include_inactive)


# Dashboard endpoint
@router.get("/dashboard", response_model=LabDashboardResponse)
async def get_lab_dashboard(
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get laboratory dashboard statistics. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to the laboratory dashboard"
        )
    
    return await lab_service.get_lab_dashboard()


# Utility endpoints for project integration
@router.get("/projects/{project_id}/samples", response_model=List[SampleResponse])
async def get_samples_by_project(
    project_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get all samples for a project."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view project samples"
        )
    
    return await lab_service.get_samples_by_project(project_id)


@router.get("/visits/{visit_id}/samples", response_model=List[SampleResponse])
async def get_samples_by_visit(
    visit_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    lab_service: LabService = Depends(get_lab_service),
    db: Pool = Depends(get_db)
):
    """Get all samples for a project visit."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view visit samples"
        )
    
    return await lab_service.get_samples_by_visit(visit_id)