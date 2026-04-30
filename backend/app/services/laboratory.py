from typing import Optional, List, Dict, Any
from datetime import date
from asyncpg import Pool
from app.db.queries.manager import query_manager
from app.schemas.laboratory import (
    # Sample schemas
    SampleCreate, SampleUpdate, SampleResponse,
    # Batch schemas
    SampleBatchCreate, SampleBatchUpdate, SampleBatchResponse,
    BatchSampleAssign, BatchSampleRemove,
    # Analysis run schemas
    AnalysisRunCreate, AnalysisRunUpdate, AnalysisRunResponse,
    RunSampleAssign,
    # Analysis result schemas
    AnalysisResultCreate, AnalysisResultUpdate, AnalysisResultResponse,
    # QA schemas
    QAReviewCreate, QAReviewUpdate, QAReviewResponse,
    # Method schemas
    MethodCreate, MethodUpdate, MethodResponse,
    # Dashboard
    LabDashboardResponse,
    # Enums
    SampleStatus, BatchStatus, AnalysisRunStatus, QAStatus
)


class LabService:
    def __init__(self, pool: Pool):
        self.pool = pool

    # Sample management
    async def create_sample(self, sample_in: SampleCreate) -> SampleResponse:
        """Create a new sample."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.lab_create_sample,
                sample_in.project_id,
                sample_in.visit_id,
                sample_in.sample_id,
                sample_in.sample_type,
                sample_in.matrix,
                sample_in.collection_date,
                sample_in.collection_time,
                sample_in.collector_name,
                sample_in.location_description,
                sample_in.depth,
                sample_in.coordinates,
                sample_in.weather_conditions,
                sample_in.temperature,
                sample_in.ph,
                sample_in.notes,
                sample_in.status.value
            )
            return SampleResponse(**dict(row))

    async def get_sample_by_id(self, sample_id: int) -> Optional[SampleResponse]:
        """Get a sample by ID with related data."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.lab_get_sample,
                sample_id
            )
            return SampleResponse(**dict(row)) if row else None

    async def update_sample(self, sample_id: int, sample_in: SampleUpdate) -> Optional[SampleResponse]:
        """Update a sample."""
        async with self.pool.acquire() as conn:
            update_data = sample_in.model_dump(exclude_unset=True)
            
            row = await conn.fetchrow(
                query_manager.lab_update_sample,
                sample_id,
                update_data.get('sample_type'),
                update_data.get('matrix'),
                update_data.get('collection_date'),
                update_data.get('collection_time'),
                update_data.get('collector_name'),
                update_data.get('location_description'),
                update_data.get('depth'),
                update_data.get('coordinates'),
                update_data.get('weather_conditions'),
                update_data.get('temperature'),
                update_data.get('ph'),
                update_data.get('notes'),
                update_data.get('status').value if update_data.get('status') else None
            )
            return SampleResponse(**dict(row)) if row else None

    async def list_samples(self) -> List[SampleResponse]:
        """List all samples."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.lab_list_samples)
            return [SampleResponse(**dict(row)) for row in rows]

    async def get_samples_by_status(self, status: SampleStatus) -> List[SampleResponse]:
        """Get samples by status."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.lab_get_samples_by_status,
                status.value
            )
            return [SampleResponse(**dict(row)) for row in rows]

    async def get_unassigned_samples(self) -> List[SampleResponse]:
        """Get samples not assigned to any batch."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.lab_get_unassigned_samples)
            return [SampleResponse(**dict(row)) for row in rows]

    # Sample Batch management
    async def create_sample_batch(self, batch_in: SampleBatchCreate) -> SampleBatchResponse:
        """Create a new sample batch."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.create_sample_batch,
                batch_in.batch_number,
                batch_in.description,
                batch_in.analyst_id,
                batch_in.lab_workflow_id,
                batch_in.expected_completion_date,
                batch_in.notes,
                BatchStatus.OPEN.value  # Default status
            )
            return SampleBatchResponse(**dict(row))

    async def get_batch_by_id(self, batch_id: int) -> Optional[SampleBatchResponse]:
        """Get a batch by ID with related data."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.get_sample_batch,
                batch_id
            )
            return SampleBatchResponse(**dict(row)) if row else None

    async def update_batch(self, batch_id: int, batch_in: SampleBatchUpdate) -> Optional[SampleBatchResponse]:
        """Update a sample batch."""
        async with self.pool.acquire() as conn:
            update_data = batch_in.model_dump(exclude_unset=True)
            
            row = await conn.fetchrow(
                query_manager.update_sample_batch,
                batch_id,
                update_data.get('description'),
                update_data.get('analyst_id'),
                update_data.get('expected_completion_date'),
                update_data.get('notes'),
                update_data.get('status').value if update_data.get('status') else None,
                update_data.get('actual_completion_date')
            )
            return SampleBatchResponse(**dict(row)) if row else None

    async def list_batches(self) -> List[SampleBatchResponse]:
        """List all sample batches."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.list_sample_batches)
            return [SampleBatchResponse(**dict(row)) for row in rows]

    async def get_batch_samples(self, batch_id: int) -> List[SampleResponse]:
        """Get all samples in a batch."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_batch_samples,
                batch_id
            )
            return [SampleResponse(**dict(row)) for row in rows]

    async def assign_samples_to_batch(self, batch_id: int, assign: BatchSampleAssign) -> List[SampleResponse]:
        """Assign samples to a batch."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.assign_samples_to_batch,
                batch_id,
                assign.sample_ids
            )
            return [SampleResponse(**dict(row)) for row in rows]

    async def remove_samples_from_batch(self, batch_id: int, remove: BatchSampleRemove) -> List[SampleResponse]:
        """Remove samples from a batch."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.remove_samples_from_batch,
                batch_id,
                remove.sample_ids
            )
            return [SampleResponse(**dict(row)) for row in rows]

    # Analysis Run management
    async def create_analysis_run(self, run_in: AnalysisRunCreate) -> AnalysisRunResponse:
        """Create a new analysis run."""
        async with self.pool.acquire() as conn:
            # Create the analysis run
            row = await conn.fetchrow(
                query_manager.create_analysis_run,
                run_in.batch_id,
                run_in.run_number,
                run_in.method_id,
                run_in.analyst_id,
                run_in.instrument,
                run_in.calibration_date,
                run_in.notes,
                AnalysisRunStatus.PENDING.value  # Default status
            )
            
            run_id = row['id']
            
            # Assign samples to the run if provided
            if run_in.sample_ids:
                await conn.execute(
                    query_manager.assign_samples_to_run,
                    run_id,
                    run_in.sample_ids
                )
            
            # Get the complete run data
            complete_row = await conn.fetchrow(
                query_manager.get_analysis_run,
                run_id
            )
            return AnalysisRunResponse(**dict(complete_row))

    async def get_analysis_run_by_id(self, run_id: int) -> Optional[AnalysisRunResponse]:
        """Get an analysis run by ID with related data."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.get_analysis_run,
                run_id
            )
            return AnalysisRunResponse(**dict(row)) if row else None

    async def update_analysis_run(self, run_id: int, run_in: AnalysisRunUpdate) -> Optional[AnalysisRunResponse]:
        """Update an analysis run."""
        async with self.pool.acquire() as conn:
            update_data = run_in.model_dump(exclude_unset=True)
            
            row = await conn.fetchrow(
                query_manager.update_analysis_run,
                run_id,
                update_data.get('method_id'),
                update_data.get('analyst_id'),
                update_data.get('instrument'),
                update_data.get('calibration_date'),
                update_data.get('notes'),
                update_data.get('status').value if update_data.get('status') else None,
                update_data.get('completion_date')
            )
            return AnalysisRunResponse(**dict(row)) if row else None

    async def list_analysis_runs(self) -> List[AnalysisRunResponse]:
        """List all analysis runs."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.list_analysis_runs)
            return [AnalysisRunResponse(**dict(row)) for row in rows]

    async def get_runs_by_batch(self, batch_id: int) -> List[AnalysisRunResponse]:
        """Get all analysis runs for a batch."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_runs_by_batch,
                batch_id
            )
            return [AnalysisRunResponse(**dict(row)) for row in rows]

    async def get_run_samples(self, run_id: int) -> List[SampleResponse]:
        """Get all samples assigned to an analysis run."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_run_samples,
                run_id
            )
            return [SampleResponse(**dict(row)) for row in rows]

    async def assign_samples_to_run(self, run_id: int, assign: RunSampleAssign) -> List[Dict]:
        """Assign samples to an analysis run."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.assign_samples_to_run,
                run_id,
                assign.sample_ids
            )
            return [dict(row) for row in rows]

    async def remove_samples_from_run(self, run_id: int, sample_ids: List[int]) -> List[Dict]:
        """Remove samples from an analysis run."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.remove_samples_from_run,
                run_id,
                sample_ids
            )
            return [dict(row) for row in rows]

    # Analysis Results management
    async def create_analysis_result(self, result_in: AnalysisResultCreate) -> AnalysisResultResponse:
        """Create an analysis result."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.create_analysis_result,
                result_in.run_id,
                result_in.sample_id,
                result_in.parameter,
                result_in.value,
                result_in.units,
                result_in.detection_limit,
                result_in.quantification_limit,
                result_in.uncertainty,
                result_in.dilution_factor,
                result_in.flags,
                result_in.notes
            )
            return AnalysisResultResponse(**dict(row))

    async def get_analysis_result_by_id(self, result_id: int) -> Optional[AnalysisResultResponse]:
        """Get an analysis result by ID."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.get_analysis_result,
                result_id
            )
            return AnalysisResultResponse(**dict(row)) if row else None

    async def update_analysis_result(self, result_id: int, result_in: AnalysisResultUpdate) -> Optional[AnalysisResultResponse]:
        """Update an analysis result."""
        async with self.pool.acquire() as conn:
            update_data = result_in.model_dump(exclude_unset=True)
            
            row = await conn.fetchrow(
                query_manager.update_analysis_result,
                result_id,
                update_data.get('parameter'),
                update_data.get('value'),
                update_data.get('units'),
                update_data.get('detection_limit'),
                update_data.get('quantification_limit'),
                update_data.get('uncertainty'),
                update_data.get('dilution_factor'),
                update_data.get('flags'),
                update_data.get('notes')
            )
            return AnalysisResultResponse(**dict(row)) if row else None

    async def get_results_by_run(self, run_id: int) -> List[AnalysisResultResponse]:
        """Get all results for an analysis run."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_results_by_run,
                run_id
            )
            return [AnalysisResultResponse(**dict(row)) for row in rows]

    async def get_results_by_sample(self, sample_id: int) -> List[AnalysisResultResponse]:
        """Get all results for a sample."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_results_by_sample,
                sample_id
            )
            return [AnalysisResultResponse(**dict(row)) for row in rows]

    # QA Review management
    async def create_qa_review(self, review_in: QAReviewCreate) -> QAReviewResponse:
        """Create a new QA review."""
        # QA reviews table not implemented yet
        raise NotImplementedError("QA review functionality not yet implemented")

    async def get_qa_review_by_id(self, review_id: int) -> Optional[QAReviewResponse]:
        """Get a QA review by ID."""
        # QA reviews table not implemented yet
        return None

    async def update_qa_review(self, review_id: int, review_in: QAReviewUpdate) -> Optional[QAReviewResponse]:
        """Update a QA review."""
        # QA reviews table not implemented yet
        return None

    async def get_qa_reviews_by_item(self, item_type: str, item_id: int) -> List[QAReviewResponse]:
        """Get all QA reviews for a specific item."""
        # QA reviews table not implemented yet
        return []

    async def list_pending_qa_reviews(self) -> List[QAReviewResponse]:
        """List all pending QA reviews."""
        # QA reviews table not implemented yet
        return []

    # Methods management
    async def create_method(self, method_in: MethodCreate) -> MethodResponse:
        """Create a new analysis method."""
        # Methods table not implemented yet
        raise NotImplementedError("Methods functionality not yet implemented")

    async def get_method_by_id(self, method_id: int) -> Optional[MethodResponse]:
        """Get a method by ID."""
        # Methods table not implemented yet
        return None

    async def update_method(self, method_id: int, method_in: MethodUpdate) -> Optional[MethodResponse]:
        """Update an analysis method."""
        # Methods table not implemented yet
        return None

    async def list_methods(self, include_inactive: bool = False) -> List[MethodResponse]:
        """List analysis methods."""
        # Methods table not implemented yet, return empty list
        return []

    # Dashboard and analytics
    async def get_lab_dashboard(self) -> LabDashboardResponse:
        """Get laboratory dashboard statistics."""
        async with self.pool.acquire() as conn:
            # Get basic stats
            stats_row = await conn.fetchrow(query_manager.get_lab_dashboard_stats)
            
            # Get recent completions
            completions = await conn.fetch(query_manager.get_recent_completions)
            recent_completions = [dict(row) for row in completions]
            
            return LabDashboardResponse(
                **dict(stats_row),
                recent_completions=recent_completions
            )

    # Utility methods for workflow management
    async def get_samples_by_project(self, project_id: int) -> List[SampleResponse]:
        """Get all samples for a project."""
        # This would use existing samples.sql queries
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT s.*, p.name as project_name, c.name as company_name, sb.batch_number "
                "FROM samples s "
                "LEFT JOIN projects p ON s.project_id = p.id "
                "LEFT JOIN companies c ON p.company_id = c.id "
                "LEFT JOIN sample_batches sb ON s.batch_id = sb.id "
                "WHERE s.project_id = $1 "
                "ORDER BY s.created_at DESC",
                project_id
            )
            return [SampleResponse(**dict(row)) for row in rows]

    async def get_samples_by_visit(self, visit_id: int) -> List[SampleResponse]:
        """Get all samples for a project visit."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT s.*, p.name as project_name, c.name as company_name, sb.batch_number "
                "FROM samples s "
                "LEFT JOIN projects p ON s.project_id = p.id "
                "LEFT JOIN companies c ON p.company_id = c.id "
                "LEFT JOIN sample_batches sb ON s.batch_id = sb.id "
                "WHERE s.visit_id = $1 "
                "ORDER BY s.created_at DESC",
                visit_id
            )
            return [SampleResponse(**dict(row)) for row in rows]

    async def update_sample_status(self, sample_id: int, status: SampleStatus) -> Optional[SampleResponse]:
        """Update just the status of a sample."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "UPDATE samples SET status = $2, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = $1 RETURNING *",
                sample_id,
                status.value
            )
            if row:
                # Get the enhanced data
                enhanced_row = await conn.fetchrow(
                    query_manager.get_sample,
                    sample_id
                )
                return SampleResponse(**dict(enhanced_row))
            return None