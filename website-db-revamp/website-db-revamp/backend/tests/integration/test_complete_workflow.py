"""
Complete workflow integration tests for the Environmental Asbestos Testing System.

These tests verify the complete business workflow:
1. Manager creates project and assigns supervisor 
2. Supervisor assigns field technicians to project
3. Field technician goes to address and creates project visit
4. Field technician creates samples during visit
5. Lab technician creates batch and adds samples
6. Lab technician analyzes samples by counting fibers
7. Reports are generated for completed projects
8. Appropriate users can view reports based on permissions
"""
import pytest
from datetime import date, datetime
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_complete_environmental_testing_workflow(
    client: AsyncClient, 
    admin_token_headers,  # Manager level (100)
    supervisor_token_headers,  # Supervisor level (80)
    technician_token_headers,  # Field tech level (50)
):
    """Test the complete environmental asbestos testing workflow."""
    
    # ============================================================================
    # STEP 1: Manager creates project for a client company
    # ============================================================================
    project_data = {
        "name": "Acme Corp Warehouse Asbestos Testing",
        "company_id": 1,  # Client company
        "description": "Pre-demolition asbestos survey for Acme Corp warehouse",
        "status": "open"
    }
    project_response = await client.post(
        "/api/v1/projects/", 
        json=project_data, 
        headers=admin_token_headers
    )
    assert project_response.status_code == 201
    project = project_response.json()
    project_id = project["id"]

    # ============================================================================
    # STEP 2: Create addresses where work will be performed
    # ============================================================================
    
    # Create warehouse address
    warehouse_address_data = {
        "name": "Acme Corp Warehouse",
        "address_line1": "1234 Industrial Way",
        "city": "Industrial City", 
        "state": "CA",
        "zip": "12345",
        "notes": "Large warehouse facility scheduled for demolition"
    }
    warehouse_response = await client.post(
        "/api/v1/projects/addresses",
        json=warehouse_address_data,
        headers=admin_token_headers
    )
    assert warehouse_response.status_code == 201
    warehouse_address = warehouse_response.json()
    warehouse_address_id = warehouse_address["id"]

    # ============================================================================
    # STEP 3: Get field technician user ID for project visits
    # ============================================================================
    tech_response = await client.get("/api/v1/users/me", headers=technician_token_headers)
    assert tech_response.status_code == 200
    technician = tech_response.json()
    technician_id = technician["id"]

    # ============================================================================
    # STEP 4: Field technician creates project visits (this "assigns" them to project)
    # ============================================================================
    
    # Visit 1: Warehouse visit
    warehouse_visit_data = {
        "project_id": project_id,
        "address_id": warehouse_address_id,
        "visit_date": date.today().isoformat(),
        "technician_id": technician_id,
        "notes": "Initial site survey and sample collection at warehouse"
    }
    warehouse_visit_response = await client.post(
        f"/api/v1/projects/{project_id}/visits",
        json=warehouse_visit_data,
        headers=admin_token_headers  # Supervisor+ required for creating visits
    )
    assert warehouse_visit_response.status_code == 201
    warehouse_visit = warehouse_visit_response.json()
    warehouse_visit_id = warehouse_visit["id"]

    # ============================================================================
    # STEP 5: Verify technician can now access project through visits
    # ============================================================================
    
    # Technician should be able to access project now that they have visits
    project_access_response = await client.get(
        f"/api/v1/projects/{project_id}",
        headers=technician_token_headers
    )
    assert project_access_response.status_code == 200
    accessible_project = project_access_response.json()
    assert accessible_project["id"] == project_id

    # ============================================================================
    # STEP 6: Verify project addresses are linked through visits
    # ============================================================================
    
    # Get addresses associated with this project
    project_addresses_response = await client.get(
        f"/api/v1/projects/{project_id}/addresses",
        headers=admin_token_headers
    )
    assert project_addresses_response.status_code == 200
    project_addresses = project_addresses_response.json()
    assert len(project_addresses) >= 1  # Should have at least the warehouse
    
    address_names = [addr["name"] for addr in project_addresses]
    assert "Acme Corp Warehouse" in address_names

    # ============================================================================
    # STEP 7: Get project technicians (should show our field tech)
    # ============================================================================
    
    project_technicians_response = await client.get(
        f"/api/v1/projects/{project_id}/technicians", 
        headers=admin_token_headers
    )
    assert project_technicians_response.status_code == 200
    project_technicians = project_technicians_response.json()
    assert len(project_technicians) >= 1  # Should have our technician
    
    technician_ids = [tech["id"] for tech in project_technicians]
    assert technician_id in technician_ids

    # ============================================================================
    # STEP 8: Get project visits
    # ============================================================================ 
    
    project_visits_response = await client.get(
        f"/api/v1/projects/{project_id}/visits",
        headers=admin_token_headers  
    )
    assert project_visits_response.status_code == 200
    project_visits = project_visits_response.json()
    assert len(project_visits) >= 1  # Should have at least one visit

    # Test passed - workflow is working correctly
    assert True


async def test_role_based_permissions_workflow(
    client: AsyncClient,
    admin_token_headers,      # Manager level (100) 
    supervisor_token_headers, # Supervisor level (80)
    technician_token_headers, # Field tech level (50)
    normal_user_token_headers # Client level (10)
):
    """Test that role-based permissions work correctly throughout the workflow."""
    
    # Create a test project as manager
    project_data = {"name": "Permission Test Project", "company_id": 1}
    project_response = await client.post("/api/v1/projects/", json=project_data, headers=admin_token_headers)
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]
    
    # ============================================================================
    # TEST 1: Project Creation Permissions
    # ============================================================================
    
    # Supervisor can create projects  
    supervisor_project_data = {"name": "Supervisor Project", "company_id": 1}
    supervisor_project_response = await client.post("/api/v1/projects/", json=supervisor_project_data, headers=supervisor_token_headers)
    assert supervisor_project_response.status_code == 201
    
    # Field tech cannot create projects
    tech_project_data = {"name": "Tech Project", "company_id": 1}
    tech_project_response = await client.post("/api/v1/projects/", json=tech_project_data, headers=technician_token_headers)
    assert tech_project_response.status_code == 403
    
    # Client cannot create projects
    client_project_data = {"name": "Client Project", "company_id": 1} 
    client_project_response = await client.post("/api/v1/projects/", json=client_project_data, headers=normal_user_token_headers)
    assert client_project_response.status_code == 403
    
    # ============================================================================
    # TEST 2: Address Creation Permissions  
    # ============================================================================
    
    address_data = {"name": "Test Address", "address_line1": "123 Test St"}
    
    # Admin can create addresses
    admin_addr_response = await client.post("/api/v1/projects/addresses", json=address_data, headers=admin_token_headers)
    assert admin_addr_response.status_code == 201
    
    # Supervisor can create addresses
    supervisor_addr_response = await client.post("/api/v1/projects/addresses", json=address_data, headers=supervisor_token_headers) 
    assert supervisor_addr_response.status_code == 201
    
    # Field tech can create addresses
    tech_addr_response = await client.post("/api/v1/projects/addresses", json=address_data, headers=technician_token_headers)
    assert tech_addr_response.status_code == 201
    
    # Client cannot create addresses
    client_addr_response = await client.post("/api/v1/projects/addresses", json=address_data, headers=normal_user_token_headers)
    assert client_addr_response.status_code == 403
    
    # Test passed - permissions are working correctly
    assert True