"""
Tests for Company Service

This module tests the company service functionality including address handling.
As per the rules, all endpoints should have proper testing.
"""

import pytest
from datetime import datetime
from app.services.companies import CompanyService, CompanyCreate, CompanyUpdate, CompanyResponse


@pytest.mark.asyncio
class TestCompanyService:
    """Test cases for CompanyService"""

    async def test_create_company_with_address(self, db_pool, sample_company_data):
        """Test creating a company with full address information"""
        service = CompanyService(db_pool)
        
        # Create company with address data
        company_data = CompanyCreate(
            name="Test Company with Address",
            address_line1="123 Main Street",
            address_line2="Suite 456",
            city="Test City",
            state="CA",
            zip="12345"
        )
        
        result = await service.create_company(company_data)
        
        # Verify the response
        assert isinstance(result, CompanyResponse)
        assert result.name == "Test Company with Address"
        assert result.address_line1 == "123 Main Street"
        assert result.address_line2 == "Suite 456"
        assert result.city == "Test City"
        assert result.state == "CA"
        assert result.zip == "12345"
        assert result.id is not None
        assert isinstance(result.created_at, datetime)
    
    async def test_create_company_minimal_data(self, db_pool):
        """Test creating a company with only required fields"""
        service = CompanyService(db_pool)
        
        # Create company with minimal data
        company_data = CompanyCreate(name="Minimal Company")
        
        result = await service.create_company(company_data)
        
        # Verify the response
        assert isinstance(result, CompanyResponse)
        assert result.name == "Minimal Company"
        assert result.address_line1 is None
        assert result.address_line2 is None
        assert result.city is None
        assert result.state is None
        assert result.zip is None
        assert result.id is not None
    
    async def test_create_company_with_google_places_data(self, db_pool):
        """Test creating a company with Google Places additional fields"""
        service = CompanyService(db_pool)
        
        # Create company with Google Places data (these should be accepted but not stored)
        company_data = CompanyCreate(
            name="Google Places Company",
            address_line1="456 Oak Avenue",
            city="San Francisco",
            state="CA",
            zip="94102",
            formatted_address="456 Oak Avenue, San Francisco, CA 94102, USA",
            google_place_id="ChIJd8BlQ2BZwokRAFUEcm_qrcA",
            latitude=37.7749,
            longitude=-122.4194
        )
        
        result = await service.create_company(company_data)
        
        # Verify that only the standard fields are stored/returned
        assert result.name == "Google Places Company"
        assert result.address_line1 == "456 Oak Avenue"
        assert result.city == "San Francisco"
        assert result.state == "CA"
        assert result.zip == "94102"
        # Google Places fields should not be in the response (not stored in DB)
        assert not hasattr(result, 'formatted_address')
        assert not hasattr(result, 'google_place_id')
        assert not hasattr(result, 'latitude')
    
    async def test_update_company_address(self, db_pool, sample_company_data):
        """Test updating a company's address information"""
        service = CompanyService(db_pool)
        
        # First create a company
        company_data = CompanyCreate(
            name="Update Test Company",
            address_line1="Old Address",
            city="Old City"
        )
        created = await service.create_company(company_data)
        
        # Update the address
        update_data = CompanyUpdate(
            address_line1="789 New Street",
            address_line2="Floor 3",
            city="New City",
            state="NY",
            zip="10001"
        )
        
        result = await service.update_company(created.id, update_data)
        
        # Verify the update
        assert result is not None
        assert result.name == "Update Test Company"  # Name unchanged
        assert result.address_line1 == "789 New Street"
        assert result.address_line2 == "Floor 3"
        assert result.city == "New City"
        assert result.state == "NY"
        assert result.zip == "10001"
    
    async def test_get_company_by_id(self, db_pool, sample_company_data):
        """Test retrieving a company by ID"""
        service = CompanyService(db_pool)
        
        # Create a company first
        company_data = CompanyCreate(
            name="Retrieval Test Company",
            address_line1="123 Test Street",
            city="Test City",
            state="TX",
            zip="75001"
        )
        created = await service.create_company(company_data)
        
        # Retrieve the company
        result = await service.get_company_by_id(created.id)
        
        # Verify retrieval
        assert result is not None
        assert result.id == created.id
        assert result.name == "Retrieval Test Company"
        assert result.address_line1 == "123 Test Street"
        assert result.city == "Test City"
        assert result.state == "TX"
        assert result.zip == "75001"
    
    async def test_get_nonexistent_company(self, db_pool):
        """Test retrieving a company that doesn't exist"""
        service = CompanyService(db_pool)
        
        # Try to get a company with a non-existent ID
        result = await service.get_company_by_id(99999)
        
        # Should return None
        assert result is None
    
    async def test_list_companies(self, db_pool):
        """Test listing all companies"""
        service = CompanyService(db_pool)
        
        # Create multiple companies
        companies_to_create = [
            CompanyCreate(name="Company A", city="City A"),
            CompanyCreate(name="Company B", city="City B"),
            CompanyCreate(name="Company C", city="City C"),
        ]
        
        created_companies = []
        for company_data in companies_to_create:
            created = await service.create_company(company_data)
            created_companies.append(created)
        
        # List all companies
        result = await service.list_companies()
        
        # Verify results
        assert isinstance(result, list)
        assert len(result) >= 3  # At least the ones we created
        
        # Check that our created companies are in the list
        created_names = {c.name for c in created_companies}
        result_names = {c.name for c in result}
        
        assert created_names.issubset(result_names)
    
    async def test_delete_company(self, db_pool):
        """Test deleting a company"""
        service = CompanyService(db_pool)
        
        # Create a company first
        company_data = CompanyCreate(name="Delete Test Company")
        created = await service.create_company(company_data)
        
        # Delete the company
        success = await service.delete_company(created.id)
        
        # Verify deletion
        assert success is True
        
        # Verify company is gone
        retrieved = await service.get_company_by_id(created.id)
        assert retrieved is None
    
    async def test_delete_nonexistent_company(self, db_pool):
        """Test deleting a company that doesn't exist"""
        service = CompanyService(db_pool)
        
        # Try to delete a non-existent company
        success = await service.delete_company(99999)
        
        # Should return False
        assert success is False


@pytest.fixture
def sample_company_data():
    """Fixture providing sample company data for testing"""
    return {
        "name": "Test Company",
        "address_line1": "123 Test Street",
        "address_line2": "Suite 100",
        "city": "Test City",
        "state": "CA",
        "zip": "90210"
    }