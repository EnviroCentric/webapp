from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum

# Enums for laboratory workflow
class SampleStatus(str, Enum):
    COLLECTED = "collected"
    RECEIVED = "received"
    IN_ANALYSIS = "in_analysis"
    ANALYZED = "analyzed"
    QA_REVIEW = "qa_review"
    COMPLETED = "completed"
    REJECTED = "rejected"

class AnalysisRunStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    QA_REVIEW = "qa_review"
    APPROVED = "approved"
    REJECTED = "rejected"

class BatchStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    IN_ANALYSIS = "in_analysis"
    COMPLETED = "completed"

class QAStatus(str, Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    REQUIRES_REVIEW = "requires_review"

# Sample schemas
class SampleCreate(BaseModel):
    project_id: int
    visit_id: Optional[int] = None  # Links to project_visits
    sample_id: str = Field(..., description="Unique sample identifier")
    sample_type: str = Field(..., description="Type of sample (soil, water, air, etc.)")
    matrix: Optional[str] = Field(None, description="Sample matrix details")
    collection_date: date
    collection_time: Optional[str] = None
    collector_name: Optional[str] = None
    location_description: Optional[str] = None
    depth: Optional[float] = Field(None, description="Sample depth in appropriate units")
    coordinates: Optional[str] = Field(None, description="GPS coordinates")
    weather_conditions: Optional[str] = None
    temperature: Optional[float] = None
    ph: Optional[float] = None
    notes: Optional[str] = None
    status: SampleStatus = SampleStatus.COLLECTED

class SampleUpdate(BaseModel):
    sample_type: Optional[str] = None
    matrix: Optional[str] = None
    collection_date: Optional[date] = None
    collection_time: Optional[str] = None
    collector_name: Optional[str] = None
    location_description: Optional[str] = None
    depth: Optional[float] = None
    coordinates: Optional[str] = None
    weather_conditions: Optional[str] = None
    temperature: Optional[float] = None
    ph: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[SampleStatus] = None

class SampleResponse(BaseModel):
    id: int
    project_id: int
    visit_id: Optional[int] = None
    batch_id: Optional[int] = None
    sample_id: str
    sample_type: str
    matrix: Optional[str] = None
    collection_date: date
    collection_time: Optional[str] = None
    collector_name: Optional[str] = None
    location_description: Optional[str] = None
    depth: Optional[float] = None
    coordinates: Optional[str] = None
    weather_conditions: Optional[str] = None
    temperature: Optional[float] = None
    ph: Optional[float] = None
    notes: Optional[str] = None
    status: SampleStatus
    created_at: datetime
    updated_at: datetime
    
    # Related data
    project_name: Optional[str] = None
    company_name: Optional[str] = None

    class Config:
        from_attributes = True

# Sample Batch schemas
class SampleBatchCreate(BaseModel):
    batch_number: str = Field(..., description="Unique batch identifier")
    description: Optional[str] = None
    analyst_id: Optional[int] = None
    lab_workflow_id: int
    expected_completion_date: Optional[date] = None
    notes: Optional[str] = None

class SampleBatchUpdate(BaseModel):
    description: Optional[str] = None
    analyst_id: Optional[int] = None
    expected_completion_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[BatchStatus] = None

class SampleBatchResponse(BaseModel):
    id: int
    batch_number: str
    description: Optional[str] = None
    analyst_id: Optional[int] = None
    lab_workflow_id: int
    status: BatchStatus
    expected_completion_date: Optional[date] = None
    actual_completion_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Related data
    analyst_name: Optional[str] = None
    workflow_name: Optional[str] = None
    sample_count: int = 0

    class Config:
        from_attributes = True

# Analysis Run schemas
class AnalysisRunCreate(BaseModel):
    batch_id: int
    run_number: str = Field(..., description="Unique run identifier within batch")
    method_id: int
    analyst_id: int
    instrument: Optional[str] = None
    calibration_date: Optional[date] = None
    sample_ids: List[int] = Field(default_factory=list, description="Samples in this run")
    notes: Optional[str] = None

class AnalysisRunUpdate(BaseModel):
    method_id: Optional[int] = None
    analyst_id: Optional[int] = None
    instrument: Optional[str] = None
    calibration_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[AnalysisRunStatus] = None
    completion_date: Optional[date] = None

class AnalysisRunResponse(BaseModel):
    id: int
    batch_id: int
    run_number: str
    method_id: int
    analyst_id: int
    instrument: Optional[str] = None
    calibration_date: Optional[date] = None
    status: AnalysisRunStatus
    completion_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Related data
    batch_number: Optional[str] = None
    method_name: Optional[str] = None
    analyst_name: Optional[str] = None
    sample_count: int = 0

    class Config:
        from_attributes = True

# Analysis Result schemas
class AnalysisResultCreate(BaseModel):
    run_id: int
    sample_id: int
    parameter: str = Field(..., description="Parameter being analyzed")
    value: Optional[float] = None
    units: Optional[str] = None
    detection_limit: Optional[float] = None
    quantification_limit: Optional[float] = None
    uncertainty: Optional[float] = None
    dilution_factor: Optional[float] = 1.0
    flags: Optional[str] = Field(None, description="Quality flags (J, U, B, etc.)")
    notes: Optional[str] = None

class AnalysisResultUpdate(BaseModel):
    parameter: Optional[str] = None
    value: Optional[float] = None
    units: Optional[str] = None
    detection_limit: Optional[float] = None
    quantification_limit: Optional[float] = None
    uncertainty: Optional[float] = None
    dilution_factor: Optional[float] = None
    flags: Optional[str] = None
    notes: Optional[str] = None

class AnalysisResultResponse(BaseModel):
    id: int
    run_id: int
    sample_id: int
    parameter: str
    value: Optional[float] = None
    units: Optional[str] = None
    detection_limit: Optional[float] = None
    quantification_limit: Optional[float] = None
    uncertainty: Optional[float] = None
    dilution_factor: Optional[float] = 1.0
    flags: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Related data
    sample_id_string: Optional[str] = None
    run_number: Optional[str] = None

    class Config:
        from_attributes = True

# QA/QC schemas
class QAReviewCreate(BaseModel):
    item_type: str = Field(..., description="Type: batch, run, or sample")
    item_id: int = Field(..., description="ID of the item being reviewed")
    reviewer_id: int
    qa_status: QAStatus
    comments: Optional[str] = None
    corrective_actions: Optional[str] = None

class QAReviewUpdate(BaseModel):
    qa_status: Optional[QAStatus] = None
    comments: Optional[str] = None
    corrective_actions: Optional[str] = None

class QAReviewResponse(BaseModel):
    id: int
    item_type: str
    item_id: int
    reviewer_id: int
    qa_status: QAStatus
    comments: Optional[str] = None
    corrective_actions: Optional[str] = None
    review_date: datetime
    created_at: datetime
    
    # Related data
    reviewer_name: Optional[str] = None

    class Config:
        from_attributes = True

# Method schemas (for analysis methods)
class MethodCreate(BaseModel):
    name: str = Field(..., description="Method name/number")
    description: Optional[str] = None
    category: Optional[str] = None
    parameters: List[str] = Field(default_factory=list, description="Parameters analyzed by this method")
    detection_limits: Optional[Dict[str, float]] = Field(default_factory=dict)
    units: Optional[Dict[str, str]] = Field(default_factory=dict)
    is_active: bool = True

class MethodUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    parameters: Optional[List[str]] = None
    detection_limits: Optional[Dict[str, float]] = None
    units: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None

class MethodResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    parameters: List[str] = Field(default_factory=list)
    detection_limits: Dict[str, float] = Field(default_factory=dict)
    units: Dict[str, str] = Field(default_factory=dict)
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Lab Workflow schemas (already exist but including for completeness)
class LabWorkflowResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    steps: List[str] = Field(default_factory=list)
    estimated_turnaround_days: Optional[int] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Batch assignment schemas
class BatchSampleAssign(BaseModel):
    sample_ids: List[int] = Field(..., description="Sample IDs to assign to batch")

class BatchSampleRemove(BaseModel):
    sample_ids: List[int] = Field(..., description="Sample IDs to remove from batch")

# Analysis run sample assignment
class RunSampleAssign(BaseModel):
    sample_ids: List[int] = Field(..., description="Sample IDs to assign to analysis run")

# Dashboard/summary schemas
class LabDashboardResponse(BaseModel):
    pending_samples: int
    in_analysis_samples: int
    completed_samples: int
    open_batches: int
    pending_qa_reviews: int
    overdue_batches: int
    recent_completions: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        from_attributes = True