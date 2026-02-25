from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import asyncpg
from app.core.security import get_current_user
from app.core.deps import require_admin
from app.db.session import get_db
from app.services.companies import CompanyService, CompanyCreate, CompanyUpdate, CompanyResponse


router = APIRouter(
    tags=["Company Management"],
    responses={403: {"description": "Insufficient permissions"}}
)


# NOTE: company records are admin-managed.
# Managers/supervisors can still view companies through list/get.


@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_in: CompanyCreate,
    current_user: dict = Depends(require_admin),
    db: asyncpg.Pool = Depends(get_db)
):
    """Create a new client company. Admin only."""
    service = CompanyService(db)
    
    # Check if company with same name already exists
    existing = await service.get_company_by_name(company_in.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Company with name '{company_in.name}' already exists"
        )
    
    return await service.create_company(company_in)


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Get a company by ID. Users can only see their own company unless they're staff."""
    service = CompanyService(db)
    company = await service.get_company_by_id(company_id)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    # Access control: users can only see their own company unless they're staff (level 50+)
    user_company_id = current_user.get("company_id")
    user_level = current_user.get("highest_level", 0)
    
    if user_level < 50 and user_company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view your own company information."
        )
    
    return company


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: int,
    company_in: CompanyUpdate,
    current_user: dict = Depends(require_admin),
    db: asyncpg.Pool = Depends(get_db)
):
    """Update a company. Admin only."""
    service = CompanyService(db)
    
    company = await service.update_company(company_id, company_in)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: int,
    current_user: dict = Depends(require_admin),
    db: asyncpg.Pool = Depends(get_db)
):
    """Delete a company. Admin only."""
    service = CompanyService(db)
    
    # Check if company exists
    company = await service.get_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    # Check if company has users (prevent deletion if users exist)
    users = await service.get_company_users(company_id)
    if users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete company. {len(users)} users are still associated with this company."
        )
    
    # Check if company has projects
    projects = await service.get_company_projects(company_id)
    if projects:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete company. {len(projects)} projects are still associated with this company."
        )
    
    success = await service.delete_company(company_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete company"
        )
    
    # 204 No Content - return nothing


@router.get("/", response_model=List[CompanyResponse])
async def list_companies(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """List companies. Staff sees all, clients see only their company."""
    service = CompanyService(db)
    user_level = current_user.get("highest_level", 0)
    user_company_id = current_user.get("company_id")
    
    # Staff (level 50+) can see all companies
    if user_level >= 50:
        return await service.list_companies()
    
    # Clients can only see their own company
    if user_company_id:
        company = await service.get_company_by_id(user_company_id)
        return [company] if company else []
    
    # Users without a company see nothing
    return []


@router.get("/{company_id}/users")
async def get_company_users(
    company_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Get users for a company."""
    service = CompanyService(db)
    
    # Check if company exists
    company = await service.get_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    # Access control: users can only see their own company unless they're staff (level 50+)
    user_company_id = current_user.get("company_id")
    user_level = current_user.get("highest_level", 0)
    
    if user_level < 50 and user_company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view your own company users."
        )
    
    users = await service.get_company_users(company_id)
    return {
        "company": company,
        "users": users,
        "total_users": len(users)
    }


@router.get("/{company_id}/projects")
async def get_company_projects(
    company_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db)
):
    """Get projects for a company with statistics."""
    service = CompanyService(db)
    
    # Check if company exists
    company = await service.get_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    # Access control: users can only see their own company unless they're staff (level 50+)
    user_company_id = current_user.get("company_id")
    user_level = current_user.get("highest_level", 0)
    
    if user_level < 50 and user_company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view your own company projects."
        )
    
    projects = await service.get_company_projects(company_id)
    return {
        "company": company,
        "projects": projects,
        "total_projects": len(projects)
    }