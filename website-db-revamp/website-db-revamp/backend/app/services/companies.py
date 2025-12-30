from typing import Optional, List
from datetime import datetime
from asyncpg import Pool
from app.db.queries.manager import query_manager
from pydantic import BaseModel, ConfigDict


class CompanyCreate(BaseModel):
    name: str
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    # Additional Google Places fields (optional, not stored in DB yet)
    formatted_address: Optional[str] = None
    google_place_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None


class CompanyResponse(BaseModel):
    id: int
    name: str
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
    
    @property
    def display_name(self) -> str:
        """Return the company name with proper title case for display."""
        if not self.name:
            return ""
        return self.name.title()


class CompanyService:
    def __init__(self, pool: Pool):
        self.pool = pool

    async def create_company(self, company_in: CompanyCreate) -> CompanyResponse:
        """Create a new client company."""
        async with self.pool.acquire() as conn:
            # Clean inputs - normalize name to lowercase
            cleaned_name = company_in.name.strip().lower() if company_in.name else ""
            
            row = await conn.fetchrow(
                query_manager.create_company,
                cleaned_name,
                company_in.address_line1,
                company_in.address_line2,
                company_in.city,
                company_in.state,
                company_in.zip
            )
            return CompanyResponse(**dict(row))

    async def get_company_by_id(self, company_id: int) -> Optional[CompanyResponse]:
        """Get a company by ID."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.get_company,
                company_id
            )
            return CompanyResponse(**dict(row)) if row else None

    async def get_company_by_name(self, name: str) -> Optional[CompanyResponse]:
        """Get a company by name."""
        async with self.pool.acquire() as conn:
            # Clean input - normalize name to lowercase for consistent lookup
            cleaned_name = name.strip().lower() if name else ""
            
            row = await conn.fetchrow(
                query_manager.get_company_by_name,
                cleaned_name
            )
            return CompanyResponse(**dict(row)) if row else None

    async def update_company(self, company_id: int, company_in: CompanyUpdate) -> Optional[CompanyResponse]:
        """Update a company."""
        async with self.pool.acquire() as conn:
            # Convert to dict and filter out None values
            update_data = company_in.model_dump(exclude_unset=True)
            
            # Clean inputs - normalize name to lowercase if provided
            cleaned_name = None
            if 'name' in update_data and update_data['name']:
                cleaned_name = update_data['name'].strip().lower()
            
            row = await conn.fetchrow(
                query_manager.update_company,
                company_id,
                cleaned_name,
                update_data.get('address_line1'),
                update_data.get('address_line2'),
                update_data.get('city'),
                update_data.get('state'),
                update_data.get('zip')
            )
            return CompanyResponse(**dict(row)) if row else None

    async def delete_company(self, company_id: int) -> bool:
        """Delete a company."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                query_manager.delete_company,
                company_id
            )
            return result == "DELETE 1"

    async def list_companies(self) -> List[CompanyResponse]:
        """List all companies."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.list_companies)
            return [CompanyResponse(**dict(row)) for row in rows]

    async def get_company_users(self, company_id: int) -> List[dict]:
        """Get all users belonging to a company."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_company_users,
                company_id
            )
            return [dict(row) for row in rows]

    async def get_company_projects(self, company_id: int) -> List[dict]:
        """Get all projects for a company with visit/sample counts."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query_manager.get_company_projects,
                company_id
            )
            return [dict(row) for row in rows]