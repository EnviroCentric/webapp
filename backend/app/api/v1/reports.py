from typing import List, Optional
from datetime import date
import os
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from asyncpg import Pool

from app.core.deps import get_db, get_current_active_user, require_manager_plus
from app.schemas.user import UserResponse
from app.schemas.report import (
    ReportCreate, ReportUpdate, LegacyReportResponse,
    ReportGenerationRequest, ReportAccessUpdate, 
    ReportDashboardResponse, ReportFormat
)
from app.services.reports import ReportService
from app.services.roles import get_user_role_level
from app.db.queries.manager import query_manager

router = APIRouter(
    tags=["Report Management"],
    responses={403: {"description": "Insufficient permissions"}}
)


def get_report_service(db: Pool = Depends(get_db)) -> ReportService:
    return ReportService(db)


REPORTS_STORAGE_DIR = Path(os.getenv("REPORTS_STORAGE_DIR", "/app/storage/reports"))


@router.get("/locations")
async def list_report_locations(
    project_id: int = Query(..., description="Project ID used to scope the company"),
    google_place_id: str = Query(..., description="Google Place ID for the address"),
    current_user: dict = Depends(require_manager_plus),
    db: Pool = Depends(get_db),
):
    """List previously used location labels for a Google Places address within the project company (manager+ only)."""
    company_id = await db.fetchval("SELECT company_id FROM projects WHERE id = $1", project_id)
    if not company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    rows = await db.fetch(query_manager.list_report_locations_for_place, company_id, google_place_id)
    return [r["location_label"] for r in rows]


@router.post("/upload", response_model=LegacyReportResponse, status_code=status.HTTP_201_CREATED)
async def upload_report_pdf(
    project_id: int = Form(...),
    report_kind: str = Form(..., description="personal|clearance|area"),
    report_date: date = Form(...),
    formatted_address: str = Form(...),
    google_place_id: str = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_label: Optional[str] = Form(None, description="Optional sub-location label for the address"),
    worker_name: Optional[str] = Form(None, description="Required when report_kind=personal"),
    technician_user_id: Optional[int] = Form(None, description="Optional technician user id"),
    technician_name: Optional[str] = Form(None, description="Technician name (freeform)"),
    report_name: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_manager_plus),
    db: Pool = Depends(get_db),
):
    """Upload a PDF report tied to a project (manager+ only)."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing filename")

    kind = (report_kind or "").strip().lower()
    if kind not in ("personal", "clearance", "area"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid report_kind")

    if kind == "personal" and not (worker_name or "").strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="worker_name is required for personal reports")

    if not (google_place_id or "").strip() or not (formatted_address or "").strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Address (google_place_id + formatted_address) is required")

    # Auto-generate a report_name if omitted.
    if not (report_name or "").strip():
        if kind == "personal":
            report_name = f"Personal Report - {worker_name.strip()} - {report_date.isoformat()}"
        else:
            report_name = f"{kind.title()} Report - {report_date.isoformat()}"

    # In this workflow, clients always have access to downloads for their company projects.
    client_visible = True
    is_final = True

    filename_lower = file.filename.lower()
    if file.content_type not in ("application/pdf", "application/x-pdf") and not filename_lower.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PDF files are supported",
        )

    project = await db.fetchrow("SELECT id FROM projects WHERE id = $1", project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    report_bytes = await file.read()
    if not report_bytes.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file does not appear to be a PDF",
        )

    REPORTS_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    project_dir = REPORTS_STORAGE_DIR / str(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}.pdf"
    rel_path = str(Path(str(project_id)) / stored_name)
    abs_path = REPORTS_STORAGE_DIR / rel_path

    try:
        abs_path.write_bytes(report_bytes)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save file")

    row = await db.fetchrow(
        query_manager.create_uploaded_report,
        project_id,
        report_name,
        kind,
        report_date,
        formatted_address,
        google_place_id,
        latitude,
        longitude,
        location_label,
        worker_name.strip() if worker_name else None,
        technician_user_id,
        (technician_name or "").strip() or None,
        rel_path,
        current_user["id"],
        json.dumps({}),
        is_final,
        client_visible,
        notes,
    )
    if not row:
        # best-effort cleanup
        try:
            abs_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create report")

    report_dict = dict(row)
    if report_dict.get("report_data") and isinstance(report_dict["report_data"], str):
        try:
            report_dict["report_data"] = json.loads(report_dict["report_data"])
        except (json.JSONDecodeError, TypeError):
            report_dict["report_data"] = {}

    return LegacyReportResponse(**report_dict)


@router.get("/{report_id}/download")
async def download_report_pdf(
    report_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Pool = Depends(get_db),
):
    """Download a report PDF.

    Clients can only download reports for their company that are client-visible and final.
    Employees must be technician+ and (if below manager) assigned to the project.
    """
    row = await db.fetchrow(query_manager.get_report, report_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    report = dict(row)

    project_company_id = await db.fetchval("SELECT company_id FROM projects WHERE id = $1", report["project_id"])

    role_level = await get_user_role_level(db, current_user.id)

    # Client users
    if current_user.company_id is not None:
        if current_user.company_id != project_company_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    else:
        # Employee users
        if role_level < 50 and not current_user.is_superuser:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        if not current_user.is_superuser and role_level < 90:
            assigned = await db.fetchval(
                query_manager.check_technician_assigned_to_project,
                report["project_id"],
                current_user.id,
            )
            if not assigned:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    rel_path = report.get("report_file_path")
    if not rel_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file not available")

    abs_path = REPORTS_STORAGE_DIR / rel_path
    if not abs_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file not found")

    return FileResponse(
        path=str(abs_path),
        media_type="application/pdf",
        filename=os.path.basename(rel_path),
    )


# Basic CRUD endpoints
@router.post("/", response_model=LegacyReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_in: ReportCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Create a new report. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can create reports"
        )
    
    return await report_service.create_report(report_in, current_user.id)


@router.get("/{report_id}", response_model=LegacyReportResponse)
async def get_report(
    report_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Get a report by ID.

    Access rules match the download endpoint:
    - Client users: must belong to the report's project company.
    - Employees: must be technician+ and (if below manager) assigned to the project.
    """
    report = await report_service.get_report_by_id(report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    project_company_id = await db.fetchval(
        "SELECT company_id FROM projects WHERE id = $1",
        report.project_id,
    )

    role_level = await get_user_role_level(db, current_user.id)

    # Client users
    if current_user.company_id is not None:
        if current_user.company_id != project_company_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return report

    # Employee users
    if role_level < 50 and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not current_user.is_superuser and role_level < 90:
        assigned = await db.fetchval(
            query_manager.check_technician_assigned_to_project,
            report.project_id,
            current_user.id,
        )
        if not assigned:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return report


@router.put("/{report_id}", response_model=LegacyReportResponse)
async def update_report(
    report_id: int,
    report_in: ReportUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Update a report. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can update reports"
        )
    
    updated_report = await report_service.update_report(report_id, report_in)
    if not updated_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    return updated_report


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Delete a report. Requires supervisor level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can delete reports"
        )
    
    success = await report_service.delete_report(report_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )


@router.post("/{report_id}/finalize", response_model=LegacyReportResponse)
async def finalize_report(
    report_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Finalize a report and make it client visible. Requires supervisor level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can finalize reports"
        )
    
    finalized_report = await report_service.finalize_report(report_id)
    if not finalized_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    return finalized_report


# List and query endpoints
@router.get("/", response_model=List[LegacyReportResponse])
async def list_reports(
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    company_id: Optional[int] = Query(None, description="Filter by company ID (admin only)"),
    pending_only: bool = Query(False, description="Show only pending reports"),
    client_visible_only: bool = Query(False, description="Show only client-visible reports"),
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """List reports based on user access level and filters."""
    role_level = await get_user_role_level(db, current_user.id)
    
    # Basic access check
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view reports"
        )
    
    if pending_only:
        reports = await report_service.get_pending_reports()
    elif project_id:
        reports = await report_service.get_project_reports(project_id)
    elif company_id:
        # Filtering by company_id should be limited:
        # - Company users may only request their own company.
        # - Employee users must be supervisor+ (or superuser).
        if current_user.company_id is not None:
            if current_user.company_id != company_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only access reports from your own company"
                )
        else:
            if role_level < 80 and not current_user.is_superuser:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only supervisors and higher can filter by company"
                )

        reports = await report_service.get_company_reports(company_id)
    elif current_user.company_id is not None:
        # Company users see only their company's reports
        reports = await report_service.get_company_reports(current_user.company_id)
        # For non-supervisors, filter to only client-visible reports
        if role_level < 80:
            reports = [r for r in reports if r.client_visible]
    else:
        # Superusers can see all reports
        reports = await report_service.list_all_reports()
    
    if client_visible_only:
        reports = [r for r in reports if r.client_visible]
    
    return reports


@router.get("/projects/{project_id}/reports", response_model=List[LegacyReportResponse])
async def get_project_reports(
    project_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Get all reports for a project."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view reports"
        )
    
    # TODO: Add company-based access control for the project
    reports = await report_service.get_project_reports(project_id)
    
    # For non-supervisors, filter to only client-visible reports
    if role_level < 80:
        reports = [r for r in reports if r.client_visible]
    
    return reports


@router.get("/addresses/{address_id}/reports", response_model=List[LegacyReportResponse])
async def get_address_reports(
    address_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
):
    """Deprecated after visit/address restructuring."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Address-scoped reports are deprecated; reports are project-scoped.",
    )


# Report generation endpoints

# Permission dependency to check analyst level before request validation
async def require_analyst_permission(
    current_user: UserResponse = Depends(get_current_active_user),
    db: Pool = Depends(get_db)
) -> UserResponse:
    """Dependency that checks if user has analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only analysts and higher can generate reports"
        )
    return current_user

@router.post("/generate", response_model=LegacyReportResponse, status_code=status.HTTP_201_CREATED)
async def generate_project_report(
    request: ReportGenerationRequest,
    current_user: UserResponse = Depends(require_analyst_permission),
    report_service: ReportService = Depends(get_report_service)
):
    """Generate a comprehensive report for a project. Requires analyst level or above."""
    try:
        report = await report_service.generate_project_report(request, current_user.id)
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Access control endpoints
@router.patch("/{report_id}/access", response_model=LegacyReportResponse)
async def update_report_access(
    report_id: int,
    access_update: ReportAccessUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Update report access settings. Requires supervisor level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 80:  # Supervisor level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and higher can update report access"
        )
    
    updated_report = await report_service.update_report_access(report_id, access_update)
    if not updated_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    return updated_report


# Dashboard endpoint
@router.get("/dashboard/stats", response_model=ReportDashboardResponse)
async def get_report_dashboard(
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Get report dashboard statistics. Requires analyst level or above."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to the report dashboard"
        )
    
    return await report_service.get_report_dashboard()


# Utility endpoints
@router.get("/{report_id}/exists")
async def check_report_exists(
    project_id: int = Query(..., description="Project ID to check"),
    address_id: int = Query(..., description="Address ID to check (deprecated)"),
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db),
):
    """Deprecated: address-scoped existence checks are no longer supported."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to check reports")

    exists = await report_service.check_report_exists(project_id, address_id)
    return {"exists": exists}


@router.get("/projects/{project_id}/data")
async def get_project_sample_data(
    project_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Get aggregated sample and analysis data for a project (for report generation preview)."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60:  # Analyst level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to project data"
        )
    
    return await report_service.get_project_sample_data(project_id)


# Client-specific endpoints (for external client access)
@router.get("/client/reports", response_model=List[LegacyReportResponse])
async def get_client_reports(
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Get all client-visible reports for the user's company."""
    # This endpoint is specifically for client users
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only for company users"
        )
    
    # Clients can access all reports for projects under their company
    reports = await report_service.get_company_reports(current_user.company_id)
    return reports


@router.get("/client/projects/{project_id}/reports", response_model=List[LegacyReportResponse])
async def get_client_project_reports(
    project_id: int,
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Get client-visible reports for a specific project."""
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only for company users"
        )
    
    # Verify that the project belongs to the user's company
    project_company_id = await db.fetchval("SELECT company_id FROM projects WHERE id = $1", project_id)
    if not project_company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project_company_id != current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    reports = await report_service.get_project_reports(project_id)
    return [r for r in reports]
