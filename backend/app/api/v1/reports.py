from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from asyncpg import Pool

from app.core.deps import get_db, get_current_active_user
from app.schemas.user import UserResponse
from app.schemas.report import (
    ReportCreate, ReportUpdate, LegacyReportResponse,
    ReportGenerationRequest, ReportAccessUpdate, 
    ReportDashboardResponse, ReportFormat
)
from app.services.reports import ReportService
from app.services.roles import get_user_role_level

router = APIRouter(
    tags=["Report Management"],
    responses={403: {"description": "Insufficient permissions"}}
)


def get_report_service(db: Pool = Depends(get_db)) -> ReportService:
    return ReportService(db)


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
    """Get a report by ID. Access control based on company affiliation and visibility."""
    report = await report_service.get_report_by_id(report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    role_level = await get_user_role_level(db, current_user.id)
    
    # Superusers can access any report
    if current_user.company_id is None:
        return report
    
    # Company users can only access reports from their company's projects
    if current_user.company_id is not None:
        # Check if report belongs to user's company projects
        # This would require additional query to verify company ownership
        
        # For client users (below supervisor), only show client-visible reports
        if role_level < 80 and not report.client_visible:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this report"
            )
    
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
        # Only superusers or the company itself can filter by company_id
        if current_user.company_id is not None and current_user.company_id != company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access reports from your own company"
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
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Get all reports for a specific address."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to view reports"
        )
    
    reports = await report_service.get_address_reports(address_id)
    
    # For non-supervisors, filter to only client-visible reports
    if role_level < 80:
        reports = [r for r in reports if r.client_visible]
    
    return reports


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
    address_id: int = Query(..., description="Address ID to check"),
    current_user: UserResponse = Depends(get_current_active_user),
    report_service: ReportService = Depends(get_report_service),
    db: Pool = Depends(get_db)
):
    """Check if a report exists for a project/address combination."""
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to check reports"
        )
    
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
    
    # Get only client-visible reports for the user's company
    reports = await report_service.get_company_reports(current_user.company_id)
    return [r for r in reports if r.client_visible and r.is_final]


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
    
    # TODO: Verify that the project belongs to the user's company
    reports = await report_service.get_project_reports(project_id)
    return [r for r in reports if r.client_visible and r.is_final]