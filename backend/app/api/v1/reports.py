from typing import List, Optional
from datetime import date
import json
import uuid
import base64
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from asyncpg import Pool
from pydantic import BaseModel

from app.core.deps import get_db, get_current_active_user, require_manager_plus
from app.schemas.user import UserResponse
from app.schemas.report import (
    ReportCreate, ReportUpdate, LegacyReportResponse,
    ReportGenerationRequest, ReportAccessUpdate, 
    ReportDashboardResponse, ReportFormat
)
from app.services.reports import ReportService
from app.services.air_reports import (
    AirReportPayload, calculate_report, decode_signature, render_report_pdf,
    safe_report_filename,
)
from app.services.roles import get_user_role_level
from app.services.report_storage import report_storage
from app.db.queries.manager import query_manager

router = APIRouter(
    tags=["Report Management"],
    responses={403: {"description": "Insufficient permissions"}}
)


def get_report_service(db: Pool = Depends(get_db)) -> ReportService:
    return ReportService(db)


class AnalystSignatureUpdate(BaseModel):
    analyst_user_id: int
    signature_data_url: str


async def require_analyst_permission(
    current_user: UserResponse = Depends(get_current_active_user),
    db: Pool = Depends(get_db),
) -> UserResponse:
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 60 and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only analysts and higher can generate reports")
    return current_user


async def _air_report_context(db: Pool, payload: AirReportPayload):
    project = await db.fetchrow(
        """SELECT p.id, p.name, p.company_id, c.name AS client_name,
                  c.address_line1, c.address_line2, c.city, c.state, c.zip
           FROM projects p LEFT JOIN companies c ON c.id = p.company_id WHERE p.id = $1""",
        payload.project_id,
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project["company_id"] or not project["client_name"]:
        raise HTTPException(
            status_code=422,
            detail="Project must be assigned to a client company before creating a report",
        )
    analyst = await db.fetchrow(
        """SELECT id, first_name, last_name, highest_level, is_superuser, analyst_signature
           FROM users WHERE id = $1 AND is_active = TRUE""",
        payload.analyst_user_id,
    )
    if not analyst:
        raise HTTPException(status_code=422, detail="Analyst not found")
    if not analyst["is_superuser"] and int(analyst["highest_level"] or 0) < 60:
        raise HTTPException(status_code=422, detail="Selected user is not an analyst")
    client_address = ", ".join(filter(None, [
        " ".join(filter(None, [project["address_line1"], project["address_line2"]])),
        project["city"],
        " ".join(filter(None, [project["state"], project["zip"]])),
    ]))
    return project, analyst, client_address


async def _build_air_report(db: Pool, payload: AirReportPayload, current_user: UserResponse):
    project, analyst, client_address = await _air_report_context(db, payload)
    calculated = calculate_report(payload)
    supplied_signature = decode_signature(payload.signature_data_url)
    signature = supplied_signature or analyst["analyst_signature"]
    role_level = await get_user_role_level(db, current_user.id)
    if not current_user.is_superuser and role_level < 90:
        assigned = await db.fetchval(
            query_manager.check_technician_assigned_to_project,
            payload.project_id,
            current_user.id,
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="You must be assigned to this project")
    if payload.save_signature_as_default and supplied_signature:
        if payload.analyst_user_id != current_user.id and role_level < 80 and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Only supervisors can save another analyst's signature")
        await db.execute("UPDATE users SET analyst_signature = $2 WHERE id = $1", payload.analyst_user_id, supplied_signature)
    analyst_name = f'{analyst["first_name"]} {analyst["last_name"]}'.title()
    pdf = render_report_pdf(
        calculated,
        client_name=project["client_name"],
        client_address=client_address,
        project_name=project["name"],
        analyst_name=analyst_name,
        signature_bytes=signature,
    )
    calculated["analyst_name"] = analyst_name
    calculated["signature_snapshot"] = (
        "data:image/png;base64," + base64.b64encode(signature).decode("ascii")
        if signature else None
    )
    return calculated, pdf


def _write_report_pdf(project_id: int, pdf: bytes, existing_path: str | None = None) -> str:
    rel_path = existing_path or str(Path(str(project_id)) / f"{uuid.uuid4().hex}.pdf")
    report_storage.put(rel_path, pdf)
    return rel_path


@router.get("/air-sample/options")
async def get_air_report_options(
    current_user: UserResponse = Depends(require_analyst_permission),
    db: Pool = Depends(get_db),
):
    """Return active technicians/analysts and whether they have saved signatures."""
    rows = await db.fetch(
        """SELECT u.id, u.first_name, u.last_name, u.highest_level,
                  u.analyst_signature
           FROM users u WHERE u.is_active = TRUE AND (u.is_superuser OR u.highest_level >= 50)
           ORDER BY u.first_name, u.last_name"""
    )
    options = []
    for row in rows:
        signature = row["analyst_signature"]
        mime = "image/jpeg" if signature and signature.startswith(b"\xff\xd8\xff") else "image/png"
        options.append({
            "id": row["id"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "highest_level": row["highest_level"],
            "has_signature": signature is not None,
            "signature_data_url": (
                f"data:{mime};base64,{base64.b64encode(signature).decode('ascii')}"
                if signature else None
            ),
            "name": f'{row["first_name"]} {row["last_name"]}'.title(),
        })
    return options


@router.put("/air-sample/signature")
async def save_analyst_signature(
    payload: AnalystSignatureUpdate,
    current_user: UserResponse = Depends(require_analyst_permission),
    db: Pool = Depends(get_db),
):
    role_level = await get_user_role_level(db, current_user.id)
    if payload.analyst_user_id != current_user.id and role_level < 80 and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only supervisors can save another analyst's signature")

    analyst_exists = await db.fetchval(
        """SELECT EXISTS(
               SELECT 1 FROM users
               WHERE id = $1 AND is_active = TRUE
                 AND (is_superuser = TRUE OR highest_level >= 60)
           )""",
        payload.analyst_user_id,
    )
    if not analyst_exists:
        raise HTTPException(status_code=404, detail="Analyst not found")

    try:
        signature = decode_signature(payload.signature_data_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not signature:
        raise HTTPException(status_code=422, detail="Draw a signature before saving")

    await db.execute(
        "UPDATE users SET analyst_signature = $2 WHERE id = $1",
        payload.analyst_user_id,
        signature,
    )
    return {"analyst_user_id": payload.analyst_user_id, "signature_data_url": payload.signature_data_url}


@router.post("/air-sample/drafts", response_model=LegacyReportResponse, status_code=201)
async def create_air_report_draft(
    payload: AirReportPayload,
    current_user: UserResponse = Depends(require_analyst_permission),
    db: Pool = Depends(get_db),
):
    try:
        calculated, pdf = await _build_air_report(db, payload, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    rel_path = _write_report_pdf(payload.project_id, pdf)
    filename = safe_report_filename(payload.formatted_address, payload.report_date)
    row = await db.fetchrow(
        query_manager.create_uploaded_report,
        payload.project_id, filename[:-4], payload.report_kind, date.fromisoformat(payload.report_date),
        payload.formatted_address, payload.google_place_id, payload.latitude, payload.longitude,
        payload.location_label, payload.worker_name, payload.technician_user_id,
        payload.technician_name, rel_path, current_user.id, json.dumps(calculated),
        False, False, payload.notes,
    )
    data = dict(row)
    data["report_data"] = calculated
    return LegacyReportResponse(**data)


@router.put("/{report_id}/air-sample", response_model=LegacyReportResponse)
async def update_air_report_draft(
    report_id: int,
    payload: AirReportPayload,
    current_user: UserResponse = Depends(require_analyst_permission),
    db: Pool = Depends(get_db),
):
    existing = await db.fetchrow("SELECT * FROM reports WHERE id = $1", report_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Report not found")
    if existing["is_final"]:
        raise HTTPException(status_code=409, detail="Finalized reports are immutable")
    if existing["project_id"] != payload.project_id:
        raise HTTPException(status_code=422, detail="A draft cannot be moved to another project")
    try:
        calculated, pdf = await _build_air_report(db, payload, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    rel_path = _write_report_pdf(payload.project_id, pdf, existing["report_file_path"])
    filename = safe_report_filename(payload.formatted_address, payload.report_date)
    row = await db.fetchrow(
        """UPDATE reports SET project_id=$2, report_name=$3, report_kind=$4, report_date=$5,
                  formatted_address=$6, google_place_id=$7, latitude=$8, longitude=$9,
                  location_label=$10, worker_name=$11, technician_user_id=$12,
                  technician_name=$13, report_file_path=$14, report_data=$15::jsonb, notes=$16
           WHERE id=$1 RETURNING *""",
        report_id, payload.project_id, filename[:-4], payload.report_kind, date.fromisoformat(payload.report_date),
        payload.formatted_address, payload.google_place_id, payload.latitude, payload.longitude,
        payload.location_label, payload.worker_name, payload.technician_user_id,
        payload.technician_name, rel_path, json.dumps(calculated), payload.notes,
    )
    data = dict(row)
    data["report_data"] = calculated
    return LegacyReportResponse(**data)

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

    stored_name = f"{uuid.uuid4().hex}.pdf"
    rel_path = str(Path(str(project_id)) / stored_name)

    try:
        report_storage.put(rel_path, report_bytes)
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
            report_storage.delete(rel_path)
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
        if not report.get("is_final") or not report.get("client_visible"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Report is not available to clients")
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

    try:
        content, content_length = report_storage.stream(rel_path)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file not found")
    except Exception:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Report storage unavailable")

    download_name = safe_report_filename(
        report.get("formatted_address") or report.get("report_name") or "report",
        str(report.get("report_date") or report.get("generated_at").date()),
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{download_name}"',
        "Cache-Control": "private, no-store",
    }
    if content_length is not None:
        headers["Content-Length"] = str(content_length)
    return StreamingResponse(
        content,
        media_type="application/pdf",
        headers=headers,
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
        if not report.is_final or not report.client_visible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Report is not available to clients")
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
    existing = await report_service.get_report_by_id(report_id)
    if existing and existing.is_final:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Finalized reports are immutable; a supervisor must return the report to draft first",
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
    return [r for r in reports if r.is_final and r.client_visible]


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
    return [r for r in reports if r.is_final and r.client_visible]
