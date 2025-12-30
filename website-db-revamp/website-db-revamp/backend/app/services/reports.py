from typing import Optional, List, Dict, Any
from datetime import datetime, date
from asyncpg import Pool
import json
import os
from pathlib import Path

from app.db.queries.manager import query_manager
from app.schemas.report import (
    ReportCreate, ReportUpdate, ReportResponse, LegacyReportResponse,
    ReportGenerationRequest, ReportContent, SampleResultSummary, ProjectSummary,
    BatchReportRequest, ReportAccessUpdate, ReportDashboardResponse,
    ReportFormat
)
from app.schemas.laboratory import SampleResponse, AnalysisResultResponse


class ReportService:
    def __init__(self, pool: Pool):
        self.pool = pool

    # Basic CRUD operations
    async def create_report(self, report_in: ReportCreate, generated_by: int) -> LegacyReportResponse:
        """Create a new report."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.create_report,
                report_in.project_id,
                report_in.address_id,
                report_in.report_name,
                None,  # report_file_path - will be set when file is generated
                generated_by,
                json.dumps(report_in.report_data) if report_in.report_data else "{}",
                report_in.is_final,
                report_in.client_visible,
                report_in.notes
            )
            return LegacyReportResponse(**dict(row))

    async def get_report_by_id(self, report_id: int) -> Optional[LegacyReportResponse]:
        """Get a report by ID with related data."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.get_report,
                report_id
            )
            if row:
                # Parse JSON data if it exists
                report_dict = dict(row)
                if report_dict.get('report_data'):
                    try:
                        report_dict['report_data'] = json.loads(report_dict['report_data'])
                    except (json.JSONDecodeError, TypeError):
                        report_dict['report_data'] = {}
                return LegacyReportResponse(**report_dict)
            return None

    async def update_report(self, report_id: int, report_in: ReportUpdate) -> Optional[LegacyReportResponse]:
        """Update a report."""
        async with self.pool.acquire() as conn:
            update_data = report_in.model_dump(exclude_unset=True)
            
            # Convert report_data to JSON string if provided
            report_data_json = None
            if 'report_data' in update_data and update_data['report_data'] is not None:
                report_data_json = json.dumps(update_data['report_data'])
            
            row = await conn.fetchrow(
                query_manager.update_report,
                report_id,
                update_data.get('report_name'),
                update_data.get('report_file_path'),
                report_data_json,
                update_data.get('is_final'),
                update_data.get('client_visible'),
                update_data.get('notes')
            )
            if row:
                # Parse JSON data
                report_dict = dict(row)
                if report_dict.get('report_data'):
                    try:
                        report_dict['report_data'] = json.loads(report_dict['report_data'])
                    except (json.JSONDecodeError, TypeError):
                        report_dict['report_data'] = {}
                return LegacyReportResponse(**report_dict)
            return None

    async def delete_report(self, report_id: int) -> bool:
        """Delete a report."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                query_manager.delete_report,
                report_id
            )
            return result == "DELETE 1"

    async def finalize_report(self, report_id: int) -> Optional[LegacyReportResponse]:
        """Mark a report as final and make it client visible."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.finalize_report,
                report_id
            )
            if row:
                # Parse JSON data
                report_dict = dict(row)
                if report_dict.get('report_data'):
                    try:
                        report_dict['report_data'] = json.loads(report_dict['report_data'])
                    except (json.JSONDecodeError, TypeError):
                        report_dict['report_data'] = {}
                return LegacyReportResponse(**report_dict)
            return None

    # Query operations
    async def list_all_reports(self) -> List[LegacyReportResponse]:
        """List all reports (for administrators)."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.list_all_reports)
            reports = []
            for row in rows:
                report_dict = dict(row)
                if report_dict.get('report_data'):
                    try:
                        report_dict['report_data'] = json.loads(report_dict['report_data'])
                    except (json.JSONDecodeError, TypeError):
                        report_dict['report_data'] = {}
                reports.append(LegacyReportResponse(**report_dict))
            return reports

    async def get_project_reports(self, project_id: int) -> List[LegacyReportResponse]:
        """Get all reports for a project."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_project_reports,
                project_id
            )
            reports = []
            for row in rows:
                report_dict = dict(row)
                if report_dict.get('report_data'):
                    try:
                        report_dict['report_data'] = json.loads(report_dict['report_data'])
                    except (json.JSONDecodeError, TypeError):
                        report_dict['report_data'] = {}
                reports.append(LegacyReportResponse(**report_dict))
            return reports

    async def get_company_reports(self, company_id: int) -> List[LegacyReportResponse]:
        """Get all client-visible reports for a company."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_company_reports,
                company_id
            )
            reports = []
            for row in rows:
                report_dict = dict(row)
                if report_dict.get('report_data'):
                    try:
                        report_dict['report_data'] = json.loads(report_dict['report_data'])
                    except (json.JSONDecodeError, TypeError):
                        report_dict['report_data'] = {}
                reports.append(LegacyReportResponse(**report_dict))
            return reports

    async def get_address_reports(self, address_id: int) -> List[LegacyReportResponse]:
        """Get all reports for a specific address."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_address_reports,
                address_id
            )
            reports = []
            for row in rows:
                report_dict = dict(row)
                if report_dict.get('report_data'):
                    try:
                        report_dict['report_data'] = json.loads(report_dict['report_data'])
                    except (json.JSONDecodeError, TypeError):
                        report_dict['report_data'] = {}
                reports.append(LegacyReportResponse(**report_dict))
            return reports

    async def get_pending_reports(self) -> List[LegacyReportResponse]:
        """Get all reports that are not yet final."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.get_pending_reports)
            reports = []
            for row in rows:
                report_dict = dict(row)
                if report_dict.get('report_data'):
                    try:
                        report_dict['report_data'] = json.loads(report_dict['report_data'])
                    except (json.JSONDecodeError, TypeError):
                        report_dict['report_data'] = {}
                reports.append(LegacyReportResponse(**report_dict))
            return reports

    async def check_report_exists(self, project_id: int, address_id: int) -> bool:
        """Check if a report already exists for a project/address combination."""
        async with self.pool.acquire() as conn:
            result = await conn.fetchval(
                query_manager.check_report_exists,
                project_id,
                address_id
            )
            return bool(result)

    # Report generation methods
    async def generate_project_report(
        self, 
        request: ReportGenerationRequest, 
        generated_by: int
    ) -> LegacyReportResponse:
        """Generate a comprehensive report for a project."""
        async with self.pool.acquire() as conn:
            # Get project information
            project_row = await conn.fetchrow(
                "SELECT p.*, c.name as company_name FROM projects p "
                "LEFT JOIN companies c ON p.company_id = c.id WHERE p.id = $1",
                request.project_id
            )
            
            if not project_row:
                raise ValueError(f"Project {request.project_id} not found")
            
            # Get samples data
            if request.include_samples:
                # Get specific samples
                samples_query = (
                    "SELECT s.*, p.name as project_name FROM samples s "
                    "LEFT JOIN projects p ON s.project_id = p.id "
                    "WHERE s.id = ANY($1::int[])"
                )
                sample_rows = await conn.fetch(samples_query, request.include_samples)
            else:
                # Get all project samples
                samples_query = (
                    "SELECT s.*, p.name as project_name FROM samples s "
                    "LEFT JOIN projects p ON s.project_id = p.id "
                    "WHERE s.project_id = $1"
                )
                sample_rows = await conn.fetch(samples_query, request.project_id)
            
            # Get analysis results for samples
            sample_results = []
            for sample_row in sample_rows:
                sample_dict = dict(sample_row)
                
                # Get analysis results for this sample
                results_query = (
                    "SELECT ar.*, run.run_number, m.name as method_name "
                    "FROM analysis_results ar "
                    "JOIN analysis_runs run ON ar.run_id = run.id "
                    "LEFT JOIN methods m ON run.method_id = m.id "
                    "WHERE ar.sample_id = $1"
                )
                results_rows = await conn.fetch(results_query, sample_dict['id'])
                
                # Organize results by parameter
                parameters = {}
                for result_row in results_rows:
                    result_dict = dict(result_row)
                    param_name = result_dict['parameter']
                    parameters[param_name] = {
                        'value': result_dict['value'],
                        'units': result_dict['units'],
                        'detection_limit': result_dict['detection_limit'],
                        'flags': result_dict['flags'],
                        'method': result_dict['method_name']
                    }
                
                sample_result = SampleResultSummary(
                    sample_id=sample_dict['sample_id'],
                    sample_type=sample_dict['sample_type'],
                    collection_date=str(sample_dict['collection_date']),
                    location=sample_dict.get('location_description'),
                    parameters=parameters,
                    flags=sample_dict.get('flags'),
                    notes=sample_dict.get('notes')
                )
                sample_results.append(sample_result)
            
            # Create structured report content
            project_summary = ProjectSummary(
                project_name=project_row['name'],
                company_name=project_row['company_name'],
                project_description=project_row.get('description'),
                start_date=str(project_row.get('current_start_date')) if project_row.get('current_start_date') else None,
                end_date=str(project_row.get('current_end_date')) if project_row.get('current_end_date') else None,
                total_samples=len(sample_results),
                completed_analyses=len([s for s in sample_results if s.parameters])
            )
            
            report_content = ReportContent(
                project_summary=project_summary,
                sample_results=sample_results
            )
            
            # Create the report record
            report_create = ReportCreate(
                project_id=request.project_id,
                address_id=request.address_id,
                report_name=request.report_name,
                report_type=request.report_type,
                report_data=report_content.model_dump(),
                is_final=False,  # Start as draft
                client_visible=request.client_visible,
                notes=request.notes
            )
            
            return await self.create_report(report_create, generated_by)

    async def update_report_access(
        self, 
        report_id: int, 
        access_update: ReportAccessUpdate
    ) -> Optional[LegacyReportResponse]:
        """Update report access settings."""
        update_data = ReportUpdate(
            client_visible=access_update.client_visible,
            is_final=access_update.is_final
        )
        return await self.update_report(report_id, update_data)

    # Dashboard and statistics
    async def get_report_dashboard(self) -> ReportDashboardResponse:
        """Get report dashboard statistics."""
        async with self.pool.acquire() as conn:
            # Get basic counts
            total_reports = await conn.fetchval("SELECT COUNT(*) FROM reports")
            draft_reports = await conn.fetchval("SELECT COUNT(*) FROM reports WHERE is_final = FALSE")
            final_reports = await conn.fetchval("SELECT COUNT(*) FROM reports WHERE is_final = TRUE")
            client_visible_reports = await conn.fetchval("SELECT COUNT(*) FROM reports WHERE client_visible = TRUE")
            pending_reports = draft_reports  # Assuming draft = pending
            
            # Get recent reports
            recent_rows = await conn.fetch(
                "SELECT r.*, p.name as project_name FROM reports r "
                "LEFT JOIN projects p ON r.project_id = p.id "
                "ORDER BY r.generated_at DESC LIMIT 5"
            )
            recent_reports = [dict(row) for row in recent_rows]
            
            # Get reports by project
            project_counts = await conn.fetch(
                "SELECT p.name, COUNT(r.id) as report_count FROM projects p "
                "LEFT JOIN reports r ON p.id = r.project_id "
                "GROUP BY p.id, p.name "
                "ORDER BY report_count DESC"
            )
            reports_by_project = {row['name']: row['report_count'] for row in project_counts}
            
            return ReportDashboardResponse(
                total_reports=total_reports,
                draft_reports=draft_reports,
                pending_reports=pending_reports,
                final_reports=final_reports,
                client_visible_reports=client_visible_reports,
                recent_reports=recent_reports,
                reports_by_project=reports_by_project
            )

    # File management utilities
    def _get_report_file_path(self, report_id: int, format: ReportFormat) -> str:
        """Generate file path for a report."""
        # This would be configured based on your file storage setup
        reports_dir = Path("reports")
        reports_dir.mkdir(exist_ok=True)
        
        file_extension = format.value
        return str(reports_dir / f"report_{report_id}.{file_extension}")

    async def _save_report_file_path(self, report_id: int, file_path: str):
        """Update the report record with the generated file path."""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE reports SET report_file_path = $2 WHERE id = $1",
                report_id,
                file_path
            )

    # Utility methods for data aggregation
    async def get_project_sample_data(self, project_id: int) -> Dict[str, Any]:
        """Get aggregated sample and analysis data for a project."""
        async with self.pool.acquire() as conn:
            # Get project info
            project = await conn.fetchrow(
                "SELECT p.*, c.name as company_name FROM projects p "
                "LEFT JOIN companies c ON p.company_id = c.id WHERE p.id = $1",
                project_id
            )
            
            # Get samples
            samples = await conn.fetch(
                "SELECT * FROM samples WHERE project_id = $1",
                project_id
            )
            
            # Get analysis results
            results = await conn.fetch(
                "SELECT ar.*, s.sample_id as sample_id_string FROM analysis_results ar "
                "JOIN samples s ON ar.sample_id = s.id "
                "WHERE s.project_id = $1",
                project_id
            )
            
            return {
                'project': dict(project) if project else None,
                'samples': [dict(s) for s in samples],
                'results': [dict(r) for r in results]
            }