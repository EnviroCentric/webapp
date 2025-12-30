import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from app.main import app
from app.api.v1.barcode import clean_barcode, validate_barcode_format

client = TestClient(app)

class TestBarcodeValidation:
    """Test suite for barcode validation and formatting functions"""

    def test_clean_barcode_empty_input(self):
        """Test cleaning empty barcode input"""
        assert clean_barcode("") == ""
        assert clean_barcode(None) == ""

    def test_clean_barcode_basic_formatting(self):
        """Test basic barcode formatting and cleaning"""
        # Test whitespace removal and uppercase conversion
        assert clean_barcode("  abc123  ") == "ABC123"
        assert clean_barcode("test-code") == "TEST-CODE"

    def test_clean_barcode_cassette_format(self):
        """Test cassette barcode format recognition"""
        # Standard BC format
        assert clean_barcode("BC-A1B2C3D4") == "BC-A1B2C3D4"
        assert clean_barcode("bc:a1b2c3d4") == "BC-A1B2C3D4"
        assert clean_barcode("BC_123456") == "BC-123456"
        
    def test_clean_barcode_qr_code_extraction(self):
        """Test QR code data extraction"""
        # QR with comma-separated data
        qr_data = "SAMPLE:BC-A1B2C3D4,DATE:2024-01-01,LOT:12345"
        assert clean_barcode(qr_data) == "BC-A1B2C3D4"
        
        # QR with semicolon-separated data
        qr_data = "INFO;ABC12345;EXTRA"
        assert clean_barcode(qr_data) == "ABC12345"

    def test_clean_barcode_numeric(self):
        """Test numeric barcode handling"""
        assert clean_barcode("123456789") == "123456789"
        assert clean_barcode("000123") == "000123"

    def test_clean_barcode_alphanumeric(self):
        """Test alphanumeric barcode handling"""
        assert clean_barcode("ABC12345") == "ABC12345"
        assert clean_barcode("XYZ-789") == "XYZ-789"

    def test_clean_barcode_invalid_characters(self):
        """Test removal of invalid characters"""
        assert clean_barcode("ABC@123#456!") == "ABC123456"
        assert clean_barcode("test barcode with spaces") == "TESTBARCODEWITHSPACES"

    def test_clean_barcode_short_codes(self):
        """Test handling of short barcodes"""
        assert clean_barcode("AB") == "AB"  # Returns original if too short
        assert clean_barcode("ABC") == "ABC"  # Minimum acceptable length

    def test_validate_barcode_format_empty(self):
        """Test validation of empty barcodes"""
        is_valid, messages = validate_barcode_format("")
        assert not is_valid
        assert "Barcode cannot be empty" in messages

    def test_validate_barcode_format_too_short(self):
        """Test validation of too short barcodes"""
        is_valid, messages = validate_barcode_format("AB")
        assert not is_valid
        assert "Barcode must be at least 3 characters long" in messages

    def test_validate_barcode_format_too_long(self):
        """Test validation of too long barcodes"""
        long_code = "A" * 51
        is_valid, messages = validate_barcode_format(long_code)
        assert not is_valid
        assert "Barcode cannot exceed 50 characters" in messages

    def test_validate_barcode_format_invalid_characters(self):
        """Test validation of invalid characters"""
        is_valid, messages = validate_barcode_format("ABC@123")
        assert not is_valid
        assert "invalid characters" in messages[0].lower()

    def test_validate_barcode_format_valid_codes(self):
        """Test validation of valid barcodes"""
        test_codes = [
            "ABC123",
            "BC-A1B2C3D4", 
            "123456789",
            "XYZ.789",
            "TEST-CODE-123"
        ]
        
        for code in test_codes:
            is_valid, messages = validate_barcode_format(code)
            assert is_valid, f"Code {code} should be valid but got messages: {messages}"

    def test_validate_barcode_format_test_warnings(self):
        """Test warnings for test/temp barcodes"""
        is_valid, messages = validate_barcode_format("TEST123")
        assert is_valid
        assert any("test/temporary barcode" in msg.lower() for msg in messages)

        is_valid, messages = validate_barcode_format("TEMP456")
        assert is_valid
        assert any("test/temporary barcode" in msg.lower() for msg in messages)

    def test_validate_barcode_format_low_entropy_warning(self):
        """Test warnings for low entropy barcodes"""
        is_valid, messages = validate_barcode_format("AAAAAA")
        assert is_valid
        assert any("low entropy" in msg.lower() for msg in messages)

        is_valid, messages = validate_barcode_format("111-111")
        assert is_valid
        assert any("low entropy" in msg.lower() for msg in messages)


class TestBarcodeEndpoints:
    """Test suite for barcode API endpoints"""

    @pytest.fixture
    def mock_auth_user(self):
        """Mock authenticated user with technician role"""
        return {
            "id": 1,
            "username": "technician",
            "email": "tech@example.com"
        }

    @pytest.fixture
    def mock_db(self):
        """Mock database connection"""
        mock_db = AsyncMock()
        mock_db.fetchrow = AsyncMock()
        return mock_db

    @patch('app.api.v1.barcode.get_current_user')
    @patch('app.api.v1.barcode.get_db')
    @patch('app.services.roles.get_user_role_level')
    async def test_validate_barcode_success(self, mock_role_level, mock_get_db, mock_get_user, mock_auth_user, mock_db):
        """Test successful barcode validation"""
        # Setup mocks
        mock_get_user.return_value = mock_auth_user
        mock_get_db.return_value = mock_db
        mock_role_level.return_value = 50  # Technician level
        mock_db.fetchrow.return_value = None  # No duplicate found

        response = client.post(
            "/api/v1/barcode/validate",
            json={
                "barcode": "BC-A1B2C3D4",
                "sample_type": "regular",
                "project_id": 1,
                "visit_id": 1
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is True
        assert data["formatted_barcode"] == "BC-A1B2C3D4"
        assert data["is_duplicate"] is False

    @patch('app.api.v1.barcode.get_current_user')
    @patch('app.services.roles.get_user_role_level')
    async def test_validate_barcode_insufficient_permissions(self, mock_role_level, mock_get_user, mock_auth_user):
        """Test barcode validation with insufficient permissions"""
        mock_get_user.return_value = mock_auth_user
        mock_role_level.return_value = 30  # Below technician level

        response = client.post(
            "/api/v1/barcode/validate",
            json={
                "barcode": "BC-A1B2C3D4",
                "sample_type": "regular"
            }
        )

        assert response.status_code == 403
        assert "Only technicians and higher roles" in response.json()["detail"]

    @patch('app.api.v1.barcode.get_current_user')
    @patch('app.api.v1.barcode.get_db')
    @patch('app.services.roles.get_user_role_level')
    async def test_validate_barcode_invalid_format(self, mock_role_level, mock_get_db, mock_get_user, mock_auth_user, mock_db):
        """Test validation of invalid barcode format"""
        mock_get_user.return_value = mock_auth_user
        mock_get_db.return_value = mock_db
        mock_role_level.return_value = 50

        response = client.post(
            "/api/v1/barcode/validate",
            json={
                "barcode": "X@",  # Too short and invalid characters
                "sample_type": "regular"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is False
        assert len(data["validation_messages"]) > 0
        assert data["is_duplicate"] is False

    @patch('app.api.v1.barcode.get_current_user')
    @patch('app.api.v1.barcode.get_db')
    @patch('app.services.roles.get_user_role_level')
    async def test_validate_barcode_duplicate_found(self, mock_role_level, mock_get_db, mock_get_user, mock_auth_user, mock_db):
        """Test validation when duplicate barcode exists"""
        mock_get_user.return_value = mock_auth_user
        mock_get_db.return_value = mock_db
        mock_role_level.return_value = 50
        
        # Mock existing sample found
        mock_db.fetchrow.return_value = {
            'id': 123,
            'description': 'Existing Sample',
            'project_id': 1,
            'visit_id': 1,
            'created_at': '2024-01-01T00:00:00Z'
        }

        response = client.post(
            "/api/v1/barcode/validate",
            json={
                "barcode": "BC-A1B2C3D4",
                "sample_type": "regular",
                "project_id": 1,
                "visit_id": 1
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is False
        assert data["is_duplicate"] is True
        assert data["existing_sample_id"] == 123
        assert "already exists" in data["validation_messages"][0].lower()

    @patch('app.api.v1.barcode.get_current_user')
    @patch('app.api.v1.barcode.get_db')
    @patch('app.services.roles.get_user_role_level')
    async def test_validate_barcode_different_project_context(self, mock_role_level, mock_get_db, mock_get_user, mock_auth_user, mock_db):
        """Test validation when barcode exists in different project"""
        mock_get_user.return_value = mock_auth_user
        mock_get_db.return_value = mock_db
        mock_role_level.return_value = 50
        
        # Mock existing sample in different project
        mock_db.fetchrow.return_value = {
            'id': 123,
            'description': 'Existing Sample',
            'project_id': 2,  # Different project
            'visit_id': 1,
            'created_at': '2024-01-01T00:00:00Z'
        }

        response = client.post(
            "/api/v1/barcode/validate",
            json={
                "barcode": "BC-A1B2C3D4",
                "sample_type": "regular",
                "project_id": 1,  # Current project
                "visit_id": 1
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is False
        assert data["is_duplicate"] is True
        assert "different project" in data["validation_messages"][0].lower()

    @patch('app.api.v1.barcode.get_current_user')
    async def test_format_barcode_success(self, mock_get_user, mock_auth_user):
        """Test barcode formatting endpoint"""
        mock_get_user.return_value = mock_auth_user

        response = client.post(
            "/api/v1/barcode/format",
            json={
                "barcode": "  bc:a1b2c3d4  "
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["formatted_barcode"] == "BC-A1B2C3D4"
        assert data["original_barcode"] == "  bc:a1b2c3d4  "
        assert "standard pattern" in data["format_applied"].lower()

    @patch('app.api.v1.barcode.get_current_user')
    async def test_format_barcode_no_change_needed(self, mock_get_user, mock_auth_user):
        """Test formatting when no changes are needed"""
        mock_get_user.return_value = mock_auth_user

        response = client.post(
            "/api/v1/barcode/format",
            json={
                "barcode": "BC-A1B2C3D4"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["formatted_barcode"] == "BC-A1B2C3D4"
        assert data["original_barcode"] == "BC-A1B2C3D4"
        assert data["format_applied"] == "No formatting applied"

    @patch('app.api.v1.barcode.get_current_user')
    async def test_get_supported_formats(self, mock_get_user, mock_auth_user):
        """Test supported formats endpoint"""
        mock_get_user.return_value = mock_auth_user

        response = client.get("/api/v1/barcode/formats")

        assert response.status_code == 200
        data = response.json()
        assert "supported_formats" in data
        assert "validation_rules" in data
        assert "notes" in data
        
        # Check that expected formats are present
        format_names = [f["name"] for f in data["supported_formats"]]
        expected_formats = ["Cassette Barcode", "Numeric Barcode", "Alphanumeric Barcode", "QR Code"]
        
        for expected in expected_formats:
            assert expected in format_names

    async def test_validate_barcode_missing_auth(self):
        """Test validation endpoint without authentication"""
        response = client.post(
            "/api/v1/barcode/validate",
            json={
                "barcode": "BC-A1B2C3D4",
                "sample_type": "regular"
            }
        )

        assert response.status_code == 401

    async def test_validate_barcode_invalid_payload(self):
        """Test validation with invalid request payload"""
        # Test with missing required barcode field
        response = client.post(
            "/api/v1/barcode/validate",
            json={
                "sample_type": "regular"
            }
        )

        assert response.status_code == 422  # Validation error

    @patch('app.api.v1.barcode.get_current_user')
    @patch('app.api.v1.barcode.get_db')
    @patch('app.services.roles.get_user_role_level')
    async def test_validate_barcode_with_formatting(self, mock_role_level, mock_get_db, mock_get_user, mock_auth_user, mock_db):
        """Test validation that includes barcode formatting"""
        mock_get_user.return_value = mock_auth_user
        mock_get_db.return_value = mock_db
        mock_role_level.return_value = 50
        mock_db.fetchrow.return_value = None

        response = client.post(
            "/api/v1/barcode/validate",
            json={
                "barcode": "  bc:a1b2c3d4  ",  # Will be formatted
                "sample_type": "regular"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is True
        assert data["formatted_barcode"] == "BC-A1B2C3D4"
        assert any("formatted from" in msg for msg in data["validation_messages"])

    @patch('app.api.v1.barcode.get_current_user')
    @patch('app.api.v1.barcode.get_db')
    @patch('app.services.roles.get_user_role_level')
    async def test_validate_barcode_database_error(self, mock_role_level, mock_get_db, mock_get_user, mock_auth_user, mock_db):
        """Test handling of database errors during validation"""
        mock_get_user.return_value = mock_auth_user
        mock_get_db.return_value = mock_db
        mock_role_level.return_value = 50
        
        # Mock database error
        mock_db.fetchrow.side_effect = Exception("Database connection error")

        response = client.post(
            "/api/v1/barcode/validate",
            json={
                "barcode": "BC-A1B2C3D4",
                "sample_type": "regular"
            }
        )

        # Should handle error gracefully (exact response depends on error handling implementation)
        assert response.status_code in [500, 503]  # Server error or service unavailable