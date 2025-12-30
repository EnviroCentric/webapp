from typing import Optional, List, Dict
from datetime import date
from asyncpg import Pool
from app.db.queries.manager import query_manager
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectVisitCreate, ProjectVisitUpdate, ProjectVisitResponse
)


class ProjectService:
    def __init__(self, pool: Pool):
        self.pool = pool

    async def create_project(self, project_in: ProjectCreate) -> ProjectResponse:
        """Create a new environmental project."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.create_project,
                project_in.company_id,
                project_in.name,
                project_in.description,
                project_in.status,
                project_in.current_start_date,
                project_in.current_end_date
            )
            return ProjectResponse(**dict(row))

    async def get_project_by_id(self, project_id: int) -> Optional[ProjectResponse]:
        """Get a project by ID."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.get_project,
                project_id
            )
            return ProjectResponse(**dict(row)) if row else None

    async def update_project(self, project_id: int, project_in: ProjectUpdate) -> Optional[ProjectResponse]:
        """Update a project."""
        async with self.pool.acquire() as conn:
            update_data = project_in.model_dump(exclude_unset=True)
            
            row = await conn.fetchrow(
                query_manager.update_project,
                project_id,
                update_data.get('name'),
                update_data.get('description'),
                update_data.get('status'),
                update_data.get('current_start_date'),
                update_data.get('current_end_date')
            )
            return ProjectResponse(**dict(row)) if row else None

    async def delete_project(self, project_id: int) -> bool:
        """Delete a project."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                query_manager.delete_project,
                project_id
            )
            return result == "DELETE 1"

    async def list_projects(self) -> List[ProjectResponse]:
        """List all projects."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.list_projects)
            return [ProjectResponse(**dict(row)) for row in rows]

    async def list_projects_by_company(self, company_id: int) -> List[ProjectResponse]:
        """List projects for a specific company."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.list_projects_by_company,
                company_id
            )
            return [ProjectResponse(**dict(row)) for row in rows]

    async def list_technician_projects(self, technician_id: int) -> List[Dict]:
        """List projects assigned to a technician."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.list_technician_projects,
                technician_id
            )
        return [dict(row) for row in rows]

    async def _create_blank_samples(self, conn, visit_id: int, project_id: int, technician_id: int):
        """Create default lab blank and field blank samples for a visit."""
        # Create lab blank
        await conn.execute(
            query_manager.create_sample,
            project_id,      # project_id
            None,           # address_id (NULL for visit-based system)
            visit_id,       # visit_id
            technician_id,  # collected_by
            "NOW()",        # collected_at
            "Lab Blank",   # description
            None,           # is_inside
            None,           # flow_rate (NULL for blanks)
            None,           # volume_required (NULL for blanks)
            "collected",   # sample_status
            "lab_blank",   # sample_type
            "PENDING_SCAN" # cassette_barcode (placeholder until scanned)
        )
        
        # Create field blank
        await conn.execute(
            query_manager.create_sample,
            project_id,      # project_id
            None,           # address_id (NULL for visit-based system)
            visit_id,       # visit_id
            technician_id,  # collected_by
            "NOW()",        # collected_at
            "Field Blank", # description
            None,           # is_inside
            None,           # flow_rate (NULL for blanks)
            None,           # volume_required (NULL for blanks)
            "collected",   # sample_status
            "field_blank", # sample_type
            "PENDING_SCAN" # cassette_barcode (placeholder until scanned)
        )
        
    async def create_blank_samples_for_visit(self, visit_id: int) -> bool:
        """Create blank samples for an existing visit if they don't exist."""
        async with self.pool.acquire() as conn:
            # First check if blank samples already exist for this visit
            existing_blanks = await conn.fetch(
                "SELECT id FROM samples WHERE visit_id = $1 AND sample_type IN ('lab_blank', 'field_blank')",
                visit_id
            )
            
            if len(existing_blanks) >= 2:
                return False  # Blank samples already exist
            
            # Get visit details to get project_id and technician_id
            visit = await conn.fetchrow(
                "SELECT project_id, technician_id FROM project_visits WHERE id = $1",
                visit_id
            )
            
            if not visit:
                return False  # Visit not found
            
            # Create missing blank samples
            existing_types = await conn.fetch(
                "SELECT sample_type FROM samples WHERE visit_id = $1 AND sample_type IN ('lab_blank', 'field_blank')",
                visit_id
            )
            existing_types_set = {row['sample_type'] for row in existing_types}
            
            if 'lab_blank' not in existing_types_set:
                await conn.execute(
                    query_manager.create_sample,
                    visit['project_id'],  # project_id
                    None,                # address_id (NULL for visit-based system)
                    visit_id,           # visit_id
                    visit['technician_id'], # collected_by
                    "NOW()",            # collected_at
                    "Lab Blank",       # description
                    None,               # is_inside
                    None,               # flow_rate (NULL for blanks)
                    None,               # volume_required (NULL for blanks)
                    "collected",       # sample_status
                    "lab_blank",       # sample_type
                    "PENDING_SCAN"     # cassette_barcode (placeholder until scanned)
                )
            
            if 'field_blank' not in existing_types_set:
                await conn.execute(
                    query_manager.create_sample,
                    visit['project_id'],  # project_id
                    None,                # address_id (NULL for visit-based system)
                    visit_id,           # visit_id
                    visit['technician_id'], # collected_by
                    "NOW()",            # collected_at
                    "Field Blank",     # description
                    None,               # is_inside
                    None,               # flow_rate (NULL for blanks)
                    None,               # volume_required (NULL for blanks)
                    "collected",       # sample_status
                    "field_blank",     # sample_type
                    "PENDING_SCAN"     # cassette_barcode (placeholder until scanned)
                )
            
            return True

    # Address management is now handled through project visits
    # No separate address methods needed

    # Project visits management
    async def create_project_visit(self, visit_in: ProjectVisitCreate) -> Dict:
        """Create a project visit with embedded address data."""
        async with self.pool.acquire() as conn:
            # Ensure country code is properly formatted (2 characters max) or None
            country_code = None
            if visit_in.country:
                country_code = visit_in.country[:2] if len(visit_in.country) >= 2 else visit_in.country
            
            # Map 'name' to 'description' for backward compatibility
            description = visit_in.description
            if not description and visit_in.name:
                description = visit_in.name
                
            row = await conn.fetchrow(
                query_manager.create_project_visit,
                visit_in.project_id,
                visit_in.visit_date,
                visit_in.technician_id,
                visit_in.notes,
                description,
                visit_in.address_line1,
                visit_in.address_line2,
                visit_in.city,
                visit_in.state,
                visit_in.zip,
                visit_in.formatted_address,
                visit_in.google_place_id,
                visit_in.latitude,
                visit_in.longitude,
                visit_in.place_types,
                country_code,
                visit_in.postal_code,
                visit_in.administrative_area_level_1,
                visit_in.administrative_area_level_2,
                visit_in.locality,
                visit_in.sublocality,
                visit_in.route,
                visit_in.street_number,
                visit_in.plus_code
            )
            visit_data = dict(row)
            
            # Create default blank samples for this visit
            await self._create_blank_samples(conn, visit_data['id'], visit_in.project_id, visit_in.technician_id)
            
            return visit_data

    async def update_project_visit(self, visit_id: int, visit_in: ProjectVisitUpdate) -> Optional[Dict]:
        """Update a project visit with embedded address data."""
        async with self.pool.acquire() as conn:
            update_data = visit_in.model_dump(exclude_unset=True)
            
            # Ensure country code is properly formatted (2 characters max) or None
            country_code = update_data.get('country')
            if country_code:
                country_code = country_code[:2] if len(country_code) >= 2 else country_code
            
            row = await conn.fetchrow(
                query_manager.update_project_visit,
                visit_id,
                update_data.get('visit_date'),
                update_data.get('technician_id'),
                update_data.get('notes'),
                update_data.get('description'),
                update_data.get('address_line1'),
                update_data.get('address_line2'),
                update_data.get('city'),
                update_data.get('state'),
                update_data.get('zip'),
                update_data.get('formatted_address'),
                update_data.get('google_place_id'),
                update_data.get('latitude'),
                update_data.get('longitude'),
                update_data.get('place_types'),
                country_code,
                update_data.get('postal_code'),
                update_data.get('administrative_area_level_1'),
                update_data.get('administrative_area_level_2'),
                update_data.get('locality'),
                update_data.get('sublocality'),
                update_data.get('route'),
                update_data.get('street_number'),
                update_data.get('plus_code')
            )
            return dict(row) if row else None

    async def delete_project_visit(self, visit_id: int) -> bool:
        """Delete a project visit."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                query_manager.delete_project_visit,
                visit_id
            )
            return result == "DELETE 1"

    async def get_project_visits(self, project_id: int) -> List[Dict]:
        """Get all visits for a project."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_project_visits,
                project_id
            )
            return [dict(row) for row in rows]

    async def get_project_visits_by_date(self, project_id: int, visit_date: date) -> List[Dict]:
        """Get visits for a project on a specific date."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_project_visits_by_date,
                project_id,
                visit_date
            )
            return [dict(row) for row in rows]

    async def get_project_addresses(self, project_id: int) -> List[Dict]:
        """Get all addresses associated with a project."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_project_addresses,
                project_id
            )
            return [dict(row) for row in rows]

    async def get_project_technicians(self, project_id: int) -> List[Dict]:
        """Get all technicians assigned to a project."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_project_technicians,
                project_id
            )
            return [dict(row) for row in rows]

    async def check_technician_assigned_to_project(self, project_id: int, technician_id: int) -> bool:
        """Check if a technician is assigned to a project."""
        async with self.pool.acquire() as conn:
            result = await conn.fetchval(
                query_manager.check_technician_assigned_to_project,
                project_id,
                technician_id
            )
            return bool(result)

    # Address checking is no longer needed since addresses are embedded in visits

    # Project technician assignment methods (separate from visits)
    async def assign_technician_to_project(self, project_id: int, technician_id: int, assigned_by: int) -> Optional[Dict]:
        """Assign a technician to a project for access control."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.assign_technician_to_project,
                project_id,
                technician_id,
                assigned_by
            )
            return dict(row) if row else None

    async def unassign_technician_from_project(self, project_id: int, technician_id: int) -> bool:
        """Remove a technician's assignment from a project."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                query_manager.unassign_technician_from_project,
                project_id,
                technician_id
            )
            return result == "DELETE 1"

    async def list_technician_assigned_projects(self, technician_id: int) -> List[Dict]:
        """List projects that a technician is directly assigned to."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.list_technician_assigned_projects,
                technician_id
            )
            return [dict(row) for row in rows]
    
