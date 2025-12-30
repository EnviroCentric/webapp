import pytest
from datetime import date
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectVisitCreate
from app.services.projects import ProjectService

@pytest.mark.asyncio
async def test_create_project_success(db_pool):
    """Test creating a project with valid data."""
    service = ProjectService(db_pool)
    project_data = ProjectCreate(name="Test Project", company_id=1)
    project = await service.create_project(project_data)
    assert project.name == "Test Project"
    assert project.id is not None
    assert project.company_id == 1

@pytest.mark.asyncio
async def test_get_project_success(db_pool):
    """Test getting a project that exists."""
    service = ProjectService(db_pool)
    
    # Create a project first
    project_data = ProjectCreate(name="Test Project", company_id=1)
    project = await service.create_project(project_data)

    # Get project
    result = await service.get_project_by_id(project.id)
    assert result.name == "Test Project"
    assert result.id == project.id
    assert result.company_id == 1

@pytest.mark.asyncio
async def test_get_project_not_found(db_pool):
    """Test getting a project that doesn't exist."""
    service = ProjectService(db_pool)
    result = await service.get_project_by_id(999)
    assert result is None

@pytest.mark.asyncio
async def test_update_project_success(db_pool):
    """Test updating a project with valid data."""
    service = ProjectService(db_pool)
    
    # Create a project first
    project_data = ProjectCreate(name="Test Project", company_id=1)
    project = await service.create_project(project_data)

    # Update project
    update_data = ProjectUpdate(name="Updated Project")
    updated = await service.update_project(project.id, update_data)
    assert updated.name == "Updated Project"
    assert updated.id == project.id

# Address creation is now handled through project visits

@pytest.mark.asyncio
async def test_create_project_visit_success(db_pool, technician_user):
    """Test creating a project visit with embedded address data."""
    service = ProjectService(db_pool)
    
    # Create a project first
    project_data = ProjectCreate(name="Test Project", company_id=1)
    project = await service.create_project(project_data)
    
    # Create project visit with embedded address data
    visit_data = ProjectVisitCreate(
        project_id=project.id,
        visit_date=date.today(),
        technician_id=technician_user.id,
        notes="Test visit",
        description="123 Test St",
        address_line1="123 Test Street",
        city="Test City"
    )
    visit = await service.create_project_visit(visit_data)
    assert visit["project_id"] == project.id
    assert visit["technician_id"] == technician_user.id
    assert visit["address_line1"] == "123 Test Street"
    assert visit["description"] == "123 Test St"

@pytest.mark.asyncio 
async def test_check_technician_assigned_to_project(db_pool, technician_user):
    """Test checking if a technician is assigned to a project through visits."""
    service = ProjectService(db_pool)
    
    # Create a project
    project_data = ProjectCreate(name="Test Project", company_id=1)
    project = await service.create_project(project_data)
    
    # Initially technician is not assigned
    is_assigned = await service.check_technician_assigned_to_project(project.id, technician_user.id)
    assert not is_assigned
    
    # Create a visit to assign technician (with embedded address)
    visit_data = ProjectVisitCreate(
        project_id=project.id,
        visit_date=date.today(),
        technician_id=technician_user.id,
        description="123 Test St",
        address_line1="123 Test Street"
    )
    await service.create_project_visit(visit_data)
    
    # Now technician should be assigned
    is_assigned = await service.check_technician_assigned_to_project(project.id, technician_user.id)
    assert is_assigned
