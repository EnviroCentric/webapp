import pytest
from datetime import date
from httpx import AsyncClient
from fastapi import status
from app.schemas.project import ProjectCreate, ProjectUpdate

@pytest.mark.asyncio
async def test_create_project_success(client: AsyncClient, db_pool, admin_token_headers):
    """Test creating a project with valid data."""
    project_data = {"name": "Test Project", "company_id": 1}
    response = await client.post("/api/v1/projects/", json=project_data, headers=admin_token_headers)
    assert response.status_code == 201  # Updated to expect 201 Created
    data = response.json()
    assert data["name"] == "Test Project"
    assert "id" in data

@pytest.mark.asyncio
async def test_create_project_unauthorized(client: AsyncClient, db_pool, normal_user_token_headers):
    """Test creating a project without proper authorization."""
    project_data = {"name": "Test Project", "company_id": 1}
    response = await client.post("/api/v1/projects/", json=project_data, headers=normal_user_token_headers)
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_get_project_success(client: AsyncClient, db_pool, technician_token_headers, admin_token_headers):
    """Test getting a project that exists."""
    # Create a project first
    project_data = {"name": "Test Project", "company_id": 1}
    create_response = await client.post("/api/v1/projects/", json=project_data, headers=admin_token_headers)
    project_id = create_response.json()["id"]

    # Get technician user ID from token
    tech_response = await client.get("/api/v1/users/me", headers=technician_token_headers)
    technician_id = tech_response.json()["id"]

    # Create a project visit with embedded address (this is how technicians get associated with projects)
    from datetime import date
    visit_data = {
        "project_id": project_id,
        "visit_date": date.today().isoformat(),
        "technician_id": technician_id,
        "notes": "Initial visit",
        "description": "123 Test St",
        "address_line1": "123 Test Street",
        "city": "Test City"
    }
    await client.post(f"/api/v1/projects/{project_id}/visits", json=visit_data, headers=admin_token_headers)

    # Get the project (technician should have access now through the project visit)
    response = await client.get(f"/api/v1/projects/{project_id}", headers=technician_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["id"] == project_id
    # Note: Removed addresses check since ProjectResponse doesn't include addresses field

@pytest.mark.asyncio
async def test_get_project_not_found(client: AsyncClient, db_pool, technician_token_headers):
    """Test getting a project that doesn't exist."""
    response = await client.get("/api/v1/projects/999", headers=technician_token_headers)
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_update_project_success(client: AsyncClient, db_pool, admin_token_headers):
    """Test updating a project with valid data."""
    # Create a project first
    project_data = {"name": "Test Project", "company_id": 1}
    create_response = await client.post("/api/v1/projects/", json=project_data, headers=admin_token_headers)
    project_id = create_response.json()["id"]

    # Update the project
    update_data = {"name": "Updated Project"}
    response = await client.put(f"/api/v1/projects/{project_id}", json=update_data, headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Project"

@pytest.mark.asyncio
async def test_create_project_with_address_success(client: AsyncClient, db_pool, admin_token_headers, technician_token_headers):
    """Test creating a project visit with embedded address."""
    # Create a project first
    project_data = {"name": "Test Project", "company_id": 1}
    project_response = await client.post("/api/v1/projects/", json=project_data, headers=admin_token_headers)
    project_id = project_response.json()["id"]
    
    # Get technician ID
    tech_response = await client.get("/api/v1/users/me", headers=technician_token_headers)
    technician_id = tech_response.json()["id"]
    
    # Create a project visit with embedded address
    visit_data = {
        "project_id": project_id,
        "visit_date": date.today().isoformat(),
        "technician_id": technician_id,
        "description": "123 Test St",
        "address_line1": "123 Test Street",
        "city": "Test City",
        "state": "TS",
        "zip": "12345"
    }
    response = await client.post(f"/api/v1/projects/{project_id}/addresses", json=visit_data, headers=admin_token_headers)
    assert response.status_code == 201
    data = response.json()
    assert "visit" in data
    assert data["visit"]["description"] == "123 Test St"
    assert data["visit"]["address_line1"] == "123 Test Street"

@pytest.mark.asyncio
async def test_create_project_visit_success(client: AsyncClient, db_pool, admin_token_headers, technician_token_headers):
    """Test creating a project visit."""
    # Create a project first
    project_data = {"name": "Test Project", "company_id": 1}
    create_response = await client.post("/api/v1/projects/", json=project_data, headers=admin_token_headers)
    project_id = create_response.json()["id"]

    # Get technician ID
    tech_response = await client.get("/api/v1/users/me", headers=technician_token_headers)
    technician_id = tech_response.json()["id"]

    # Create project visit with embedded address
    visit_data = {
        "project_id": project_id,
        "visit_date": date.today().isoformat(),
        "technician_id": technician_id,
        "notes": "Field visit for sampling",
        "description": "123 Test St",
        "address_line1": "123 Test Street"
    }
    response = await client.post(f"/api/v1/projects/{project_id}/visits", json=visit_data, headers=admin_token_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["project_id"] == project_id
    assert data["technician_id"] == technician_id
    assert data["description"] == "123 Test St"
    assert data["address_line1"] == "123 Test Street"

@pytest.mark.asyncio
async def test_get_project_visits_success(client: AsyncClient, db_pool, admin_token_headers, technician_token_headers):
    """Test getting project visits."""
    # Create a project first
    project_data = {"name": "Test Project", "company_id": 1}
    create_response = await client.post("/api/v1/projects/", json=project_data, headers=admin_token_headers)
    project_id = create_response.json()["id"]

    # Get technician ID
    tech_response = await client.get("/api/v1/users/me", headers=technician_token_headers)
    technician_id = tech_response.json()["id"]

    # Create project visit with embedded address
    visit_data = {
        "project_id": project_id,
        "visit_date": date.today().isoformat(),
        "technician_id": technician_id,
        "notes": "Field visit for sampling",
        "description": "123 Test St",
        "address_line1": "123 Test Street"
    }
    await client.post(f"/api/v1/projects/{project_id}/visits", json=visit_data, headers=admin_token_headers)

    # Get project visits
    response = await client.get(f"/api/v1/projects/{project_id}/visits", headers=admin_token_headers)
    assert response.status_code == 200
    visits = response.json()
    assert len(visits) > 0
    assert visits[0]["project_id"] == project_id
    assert visits[0]["description"] == "123 Test St"
    assert visits[0]["address_line1"] == "123 Test Street"

@pytest.mark.asyncio
async def test_create_project_visit_unauthorized(client: AsyncClient, db_pool, technician_token_headers):
    """Test creating a project visit without proper authorization."""
    # Create a project (this will fail for technician, but let's test the visit creation auth)
    visit_data = {
        "project_id": 999,  # Non-existent project
        "address_id": 999,  # Non-existent address  
        "visit_date": date.today().isoformat(),
        "technician_id": 1,
        "notes": "Unauthorized visit attempt"
    }
    response = await client.post(f"/api/v1/projects/999/visits", json=visit_data, headers=technician_token_headers)
    assert response.status_code in [403, 404]  # Either forbidden or not found

@pytest.mark.asyncio
async def test_get_project_addresses_success(client, admin_token_headers, technician_token_headers):
    """Test getting addresses associated with a project through visits."""
    # Create a project first
    response = await client.post(
        "/api/v1/projects/",
        headers=admin_token_headers,
        json={"name": "Test Project", "company_id": 1}
    )
    assert response.status_code == 201
    project = response.json()

    # Get technician ID
    tech_response = await client.get("/api/v1/users/me", headers=technician_token_headers)
    technician_id = tech_response.json()["id"]

    # Create project visit with embedded address (links address to project)
    visit_data = {
        "project_id": project["id"],
        "visit_date": date.today().isoformat(),
        "technician_id": technician_id,
        "notes": "Field visit",
        "description": "Test Address",
        "address_line1": "123 Test Street"
    }
    await client.post(f"/api/v1/projects/{project['id']}/visits", json=visit_data, headers=admin_token_headers)

    # Get addresses for this project
    response = await client.get(
        f"/api/v1/projects/{project['id']}/addresses",
        headers=admin_token_headers
    )
    assert response.status_code == 200
    addresses = response.json()
    assert len(addresses) > 0
    assert any(addr["address_line1"] == "123 Test Street" for addr in addresses)

# Address updates are now done through project visit updates

@pytest.mark.asyncio
async def test_get_project_visits_by_date(client: AsyncClient, technician_token_headers, admin_token_headers):
    """Test getting project visits filtered by date."""
    # Create project 
    project_resp = await client.post("/api/v1/projects/", json={"name": "Test Project", "company_id": 1}, headers=admin_token_headers)
    project_id = project_resp.json()["id"]
    
    # Get technician ID
    tech_response = await client.get("/api/v1/users/me", headers=technician_token_headers)
    technician_id = tech_response.json()["id"]
    
    # Create visit for today with embedded address
    today = date.today().isoformat()
    visit_data = {
        "project_id": project_id,
        "visit_date": today,
        "technician_id": technician_id,
        "notes": "Today's visit",
        "description": "Test Address",
        "address_line1": "123 Test Street"
    }
    await client.post(f"/api/v1/projects/{project_id}/visits", json=visit_data, headers=admin_token_headers)
    
    # Get visits for today
    resp = await client.get(f"/api/v1/projects/{project_id}/visits?visit_date={today}", headers=admin_token_headers)
    assert resp.status_code == 200
    visits = resp.json()
    assert len(visits) > 0
    assert visits[0]["visit_date"] == today
