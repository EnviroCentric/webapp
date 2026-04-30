import pytest
from datetime import date

from app.schemas.project import ProjectCreate, ProjectVisitCreate
from app.schemas.user import UserCreate
from app.services.companies import CompanyService, CompanyCreate
from app.services.projects import ProjectService
from app.services.users import UserService

pytestmark = pytest.mark.asyncio


async def test_project_service_create_and_get_project(db_pool):
    """ProjectService can create and fetch a project."""
    company = await CompanyService(db_pool).create_company(CompanyCreate(name="acme"))

    svc = ProjectService(db_pool)
    created = await svc.create_project(ProjectCreate(company_id=company.id, name="Test Project"))
    fetched = await svc.get_project_by_id(created.id)

    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.company_id == company.id
    assert fetched.name == "Test Project"


async def test_project_service_create_visit_creates_blank_samples(db_pool):
    """Creating a visit auto-creates Lab Blank + Field Blank samples."""
    company = await CompanyService(db_pool).create_company(CompanyCreate(name="acme"))
    project = await ProjectService(db_pool).create_project(ProjectCreate(company_id=company.id, name="Test Project"))

    # Create a technician user for the visit
    tech = await UserService(db_pool).create_user(
        UserCreate(
            email="tech@example.com",
            password="TechPass123!@#",
            first_name="Tech",
            last_name="User",
        )
    )

    visit = await ProjectService(db_pool).create_project_visit(
        ProjectVisitCreate(
            project_id=project.id,
            visit_date=date.today(),
            technician_id=tech.id,
            description="Warehouse A",
            address_line1="123 Test St",
            city="Testville",
            state="TS",
            zip="12345",
        )
    )

    # Verify the two blank samples were inserted
    rows = await db_pool.fetch(
        "SELECT description, cassette_barcode FROM samples WHERE visit_id = $1 ORDER BY id",
        visit["id"],
    )
    descriptions = {r["description"] for r in rows}
    assert "Lab Blank" in descriptions
    assert "Field Blank" in descriptions
