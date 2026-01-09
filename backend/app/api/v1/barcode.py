from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Optional
import re
from asyncpg.pool import Pool

from app.db.session import get_db
from app.core.security import get_current_user
from app.schemas.user import UserResponse

router = APIRouter(tags=["Barcode Scanning"])

class BarcodeValidationRequest(BaseModel):
    """Request model for barcode validation"""
    barcode: str = Field(..., description="The scanned barcode text")
    sample_type: Optional[str] = Field("regular", description="Type of sample (regular, lab_blank, field_blank)")
    project_id: Optional[int] = Field(None, description="Project ID for context validation")
    visit_id: Optional[int] = Field(None, description="Visit ID for context validation")

class BarcodeValidationResponse(BaseModel):
    """Response model for barcode validation"""
    is_valid: bool = Field(..., description="Whether the barcode is valid")
    formatted_barcode: str = Field(..., description="Cleaned/formatted barcode")
    validation_messages: list[str] = Field(default_factory=list, description="Validation messages or warnings")
    is_duplicate: bool = Field(False, description="Whether this barcode already exists")
    existing_sample_id: Optional[int] = Field(None, description="ID of existing sample with this barcode, if duplicate")

class BarcodeFormatRequest(BaseModel):
    """Request model for barcode format validation"""
    barcode: str = Field(..., description="The barcode text to format")

class BarcodeFormatResponse(BaseModel):
    """Response model for barcode formatting"""
    formatted_barcode: str = Field(..., description="Cleaned/formatted barcode")
    original_barcode: str = Field(..., description="Original barcode as scanned")
    format_applied: str = Field(..., description="Description of formatting applied")

def clean_barcode(barcode: str) -> str:
    """
    Clean and format a scanned barcode according to standard formats.
    
    Args:
        barcode: Raw barcode string
        
    Returns:
        Cleaned and formatted barcode string
    """
    if not barcode:
        return ""
    
    # Remove whitespace and convert to uppercase
    cleaned = barcode.strip().upper()
    
    # Remove common scanner artifacts and invalid characters
    cleaned = re.sub(r'[^\w\-\.]', '', cleaned)
    
    # Handle common barcode patterns
    # Pattern 1: Standard cassette barcodes (BC-XXXXXXXX)
    bc_match = re.match(r'^BC[:\-_]?([A-Z0-9]{6,10})$', cleaned)
    if bc_match:
        return f"BC-{bc_match.group(1)}"
    
    # Pattern 2: QR codes with structured data (extract relevant part)
    if ',' in cleaned or ';' in cleaned:
        # For QR codes with multiple fields, try to extract barcode portion
        parts = re.split(r'[,;]', cleaned)
        for part in parts:
            part = part.strip()
            if re.match(r'^[A-Z0-9\-]{6,}$', part):
                return part
    
    # Pattern 3: Numeric barcodes (pad if needed)
    if cleaned.isdigit() and len(cleaned) >= 6:
        return cleaned
    
    # Pattern 4: Alphanumeric with minimum length
    if re.match(r'^[A-Z0-9\-]{6,}$', cleaned):
        return cleaned
    
    # Return as-is if no pattern matches but has minimum length
    if len(cleaned) >= 3:
        return cleaned
    
    return barcode  # Return original if all else fails

def validate_barcode_format(barcode: str) -> tuple[bool, list[str]]:
    """
    Validate barcode format according to business rules.
    
    Args:
        barcode: Cleaned barcode string
        
    Returns:
        Tuple of (is_valid, validation_messages)
    """
    messages = []
    
    if not barcode:
        return False, ["Barcode cannot be empty"]
    
    if len(barcode) < 3:
        messages.append("Barcode must be at least 3 characters long")
        return False, messages
    
    if len(barcode) > 50:
        messages.append("Barcode cannot exceed 50 characters")
        return False, messages
    
    # Check for valid characters (alphanumeric, hyphens, periods)
    if not re.match(r'^[A-Z0-9\-\.]+$', barcode):
        messages.append("Barcode contains invalid characters. Only letters, numbers, hyphens, and periods are allowed")
        return False, messages
    
    # Warn about potentially problematic patterns
    if barcode.startswith('TEST') or barcode.startswith('TEMP'):
        messages.append("Warning: This appears to be a test/temporary barcode")
    
    if len(set(barcode.replace('-', '').replace('.', ''))) <= 2:
        messages.append("Warning: Barcode appears to have very low entropy (repeated characters)")
    
    return True, messages

@router.post("/validate", response_model=BarcodeValidationResponse)
async def validate_barcode(
    request: BarcodeValidationRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Pool = Depends(get_db)
):
    """
    Validate a scanned barcode for format, uniqueness, and business rules.
    
    This endpoint performs comprehensive validation of scanned barcodes including:
    - Format validation and cleaning
    - Duplicate detection within the system
    - Context-aware validation (project/visit specific rules)
    
    Requires technician level access or higher.
    """
    # Check user permissions (technician level or higher)
    from app.services.roles import get_user_role_level
    role_level = await get_user_role_level(db, current_user.id)
    if role_level < 50:  # Technician level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only technicians and higher roles can validate barcodes"
        )
    
    # Clean and format the barcode
    formatted_barcode = clean_barcode(request.barcode)
    
    # Validate format
    is_format_valid, validation_messages = validate_barcode_format(formatted_barcode)
    
    if not is_format_valid:
        return BarcodeValidationResponse(
            is_valid=False,
            formatted_barcode=formatted_barcode,
            validation_messages=validation_messages,
            is_duplicate=False
        )
    
    # Check for duplicates in the database
    duplicate_query = """
        SELECT id, description, project_id, visit_id, created_at
        FROM samples 
        WHERE cassette_barcode = $1
        ORDER BY created_at DESC
        LIMIT 1
    """
    
    existing_sample = await db.fetchrow(duplicate_query, formatted_barcode)
    
    if existing_sample:
        # Check if it's in the same project/visit context
        context_messages = []
        if request.project_id and existing_sample['project_id'] != request.project_id:
            context_messages.append(f"Barcode exists in different project (ID: {existing_sample['project_id']})")
        elif request.visit_id and existing_sample['visit_id'] != request.visit_id:
            context_messages.append(f"Barcode exists in different visit (ID: {existing_sample['visit_id']})")
        else:
            context_messages.append("Barcode already exists in the same context")
        
        return BarcodeValidationResponse(
            is_valid=False,
            formatted_barcode=formatted_barcode,
            validation_messages=validation_messages + context_messages,
            is_duplicate=True,
            existing_sample_id=existing_sample['id']
        )
    
    # All validation passed
    success_messages = validation_messages.copy()
    if formatted_barcode != request.barcode:
        success_messages.append(f"Barcode formatted from '{request.barcode}' to '{formatted_barcode}'")
    
    return BarcodeValidationResponse(
        is_valid=True,
        formatted_barcode=formatted_barcode,
        validation_messages=success_messages,
        is_duplicate=False
    )

@router.post("/format", response_model=BarcodeFormatResponse)
async def format_barcode(
    request: BarcodeFormatRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Format and clean a barcode without validation or duplicate checking.
    
    This is a utility endpoint for formatting barcodes according to standard patterns.
    Useful for preview/testing purposes.
    
    Requires authenticated user.
    """
    original = request.barcode
    formatted = clean_barcode(original)
    
    # Determine what formatting was applied
    format_description = "No formatting applied"
    if formatted != original:
        if formatted.upper() != original.upper():
            format_description = "Cleaned whitespace, normalized case, and applied standard pattern"
        elif formatted != original:
            format_description = "Normalized case and removed invalid characters"
        else:
            format_description = "Whitespace trimmed"
    
    return BarcodeFormatResponse(
        formatted_barcode=formatted,
        original_barcode=original,
        format_applied=format_description
    )

@router.get("/formats")
async def get_supported_formats(current_user: UserResponse = Depends(get_current_user)):
    """
    Get information about supported barcode formats and patterns.
    
    Returns details about the barcode formats that the system can recognize and process.
    """
    return {
        "supported_formats": [
            {
                "name": "Cassette Barcode",
                "pattern": "BC-XXXXXXXX",
                "description": "Standard laboratory cassette barcode with BC prefix",
                "example": "BC-A1B2C3D4"
            },
            {
                "name": "Numeric Barcode", 
                "pattern": "NNNNNNNN",
                "description": "Pure numeric barcode, minimum 6 digits",
                "example": "12345678"
            },
            {
                "name": "Alphanumeric Barcode",
                "pattern": "XXXXXXXX",
                "description": "Letters and numbers, minimum 6 characters",
                "example": "ABC12345"
            },
            {
                "name": "QR Code",
                "pattern": "Structured data",
                "description": "QR codes with embedded data, barcode portion extracted",
                "example": "SAMPLE:BC-A1B2C3D4,DATE:2024-01-01"
            }
        ],
        "validation_rules": [
            "Minimum length: 3 characters",
            "Maximum length: 50 characters", 
            "Allowed characters: A-Z, 0-9, hyphens (-), periods (.)",
            "Case insensitive (converted to uppercase)",
            "Whitespace and special characters are cleaned"
        ],
        "notes": [
            "Barcodes are automatically formatted to standard patterns when possible",
            "Duplicate detection is performed across all samples in the system",
            "Context-aware validation considers project and visit scope"
        ]
    }