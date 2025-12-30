from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum

# Enums for report management
class ReportStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    FINAL = "final"

class ReportFormat(str, Enum):
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"
    JSON = "json"

# Report schemas
class ReportCreate(BaseModel):
    project_id: int
    address_id: Optional[int] = None
    report_name: str = Field(..., description="Name of the report")
    report_type: str = Field(default="analysis", description="Type of report (analysis, summary, etc.)")
    report_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Report data and results")
    is_final: bool = Field(default=False, description="Whether this is a final report")
    client_visible: bool = Field(default=False, description="Whether clients can view this report")
    notes: Optional[str] = None

class ReportUpdate(BaseModel):
    report_name: Optional[str] = None
    report_type: Optional[str] = None
    report_data: Optional[Dict[str, Any]] = None
    is_final: Optional[bool] = None
    client_visible: Optional[bool] = None
    notes: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    project_id: int
    address_id: Optional[int] = None
    report_name: str
    report_type: str
    report_file_path: Optional[str] = None
    generated_by: int
    report_data: Dict[str, Any] = Field(default_factory=dict)
    is_final: bool
    client_visible: bool
    notes: Optional[str] = None
    generated_at: datetime
    
    # Related data
    project_name: Optional[str] = None
    company_name: Optional[str] = None
    address_name: Optional[str] = None
    generated_by_name: Optional[str] = None

    class Config:
        from_attributes = True

# Report generation schemas
class ReportGenerationRequest(BaseModel):
    project_id: int
    address_id: Optional[int] = None
    report_name: str
    report_type: str = "analysis"
    include_samples: List[int] = Field(default_factory=list, description="Specific sample IDs to include")
    include_all_project_samples: bool = Field(default=True, description="Include all samples from project")
    format: ReportFormat = ReportFormat.PDF
    template: Optional[str] = Field(None, description="Report template to use")
    client_visible: bool = Field(default=False, description="Make report visible to clients")
    notes: Optional[str] = None

class ReportTemplateInfo(BaseModel):
    name: str
    description: str
    supported_formats: List[ReportFormat]
    required_data: List[str] = Field(default_factory=list, description="Required data fields")

# Report content schemas for structured data
class SampleResultSummary(BaseModel):
    sample_id: str
    sample_type: str
    collection_date: str
    location: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    flags: Optional[str] = None
    notes: Optional[str] = None

class ProjectSummary(BaseModel):
    project_name: str
    company_name: str
    project_description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    total_samples: int
    completed_analyses: int

class ReportContent(BaseModel):
    """Structured report content for consistent report generation"""
    project_summary: ProjectSummary
    executive_summary: Optional[str] = None
    methodology: Optional[str] = None
    sample_results: List[SampleResultSummary] = Field(default_factory=list)
    conclusions: Optional[str] = None
    recommendations: Optional[str] = None
    quality_assurance: Optional[Dict[str, Any]] = Field(default_factory=dict)
    attachments: List[str] = Field(default_factory=list)

# Batch report generation
class BatchReportRequest(BaseModel):
    project_ids: List[int] = Field(..., description="Projects to include in batch report")
    report_name: str
    report_type: str = "batch_analysis"
    format: ReportFormat = ReportFormat.PDF
    client_visible: bool = Field(default=False)
    notes: Optional[str] = None

# Report access and sharing
class ReportAccessUpdate(BaseModel):
    client_visible: bool
    is_final: bool

class ReportShareRequest(BaseModel):
    recipient_emails: List[str] = Field(..., description="Email addresses to share report with")
    message: Optional[str] = Field(None, description="Optional message to include")
    include_download_link: bool = Field(default=True)

# Dashboard and statistics
class ReportDashboardResponse(BaseModel):
    total_reports: int
    draft_reports: int
    pending_reports: int
    final_reports: int
    client_visible_reports: int
    recent_reports: List[Dict[str, Any]] = Field(default_factory=list)
    reports_by_project: Dict[str, int] = Field(default_factory=dict)

    class Config:
        from_attributes = True

# File management
class ReportFileInfo(BaseModel):
    file_path: str
    file_size: int
    format: ReportFormat
    generated_at: datetime
    download_url: Optional[str] = None

class ReportFileResponse(BaseModel):
    report_id: int
    files: List[ReportFileInfo] = Field(default_factory=list)
    
    class Config:
        from_attributes = True

# Legacy support (for existing reports table structure)
class LegacyReportResponse(BaseModel):
    id: int
    project_id: int
    address_id: Optional[int] = None
    report_name: str
    report_file_path: Optional[str] = None
    generated_by: int
    report_data: Optional[Dict[str, Any]] = None
    is_final: bool
    client_visible: bool
    notes: Optional[str] = None
    generated_at: datetime
    
    # Related data
    project_name: Optional[str] = None
    company_name: Optional[str] = None
    address_name: Optional[str] = None
    generated_by_name: Optional[str] = None

    class Config:
        from_attributes = True