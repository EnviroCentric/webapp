# Camera-Based Barcode Scanning

This document describes the camera-based barcode and QR code scanning functionality implemented for the LIMS (Laboratory Information Management System).

## Overview

The system now supports scanning barcodes and QR codes using the device's built-in camera instead of relying on keyboard-based barcode scanners. This is especially useful for mobile devices and provides a more intuitive user experience.

## Features

### Frontend (React)
- **CameraScanner Component**: A reusable React component that provides camera access and barcode detection
- **Real-time scanning**: Uses ZXing library for real-time barcode/QR code detection
- **Multiple camera support**: Automatically selects the best camera (preferring rear/environment camera)
- **Camera switching**: Users can switch between front and back cameras
- **Torch/Flashlight support**: Toggle flashlight for better scanning in low light
- **Format detection**: Supports multiple barcode and QR code formats
- **Error handling**: Graceful handling of camera permission denials and errors

### Backend (FastAPI)
- **Barcode validation API**: Comprehensive validation and formatting endpoints
- **Format standardization**: Automatic cleaning and formatting of scanned codes
- **Duplicate detection**: Checks for existing barcodes in the system
- **Context-aware validation**: Validates barcodes within project/visit scope
- **Security**: Role-based access control (requires technician level or higher)

## Supported Formats

### Barcode Types
1. **Cassette Barcodes**: `BC-XXXXXXXX` format (standard laboratory cassettes)
2. **Numeric Barcodes**: Pure numeric codes with minimum 6 digits
3. **Alphanumeric Barcodes**: Letters and numbers, minimum 6 characters
4. **QR Codes**: Structured data with barcode extraction

### Format Examples
```
BC-A1B2C3D4    # Standard cassette barcode
12345678       # Numeric barcode  
ABC12345       # Alphanumeric barcode
SAMPLE:BC-A1B2C3D4,DATE:2024-01-01  # QR code with structured data
```

## API Endpoints

### POST `/api/v1/barcode/validate`
Validates a scanned barcode for format, uniqueness, and business rules.

**Request Body:**
```json
{
  "barcode": "BC-A1B2C3D4",
  "sample_type": "regular",
  "project_id": 1,
  "visit_id": 1
}
```

**Response:**
```json
{
  "is_valid": true,
  "formatted_barcode": "BC-A1B2C3D4",
  "validation_messages": ["Barcode formatted from 'bc:a1b2c3d4' to 'BC-A1B2C3D4'"],
  "is_duplicate": false,
  "existing_sample_id": null
}
```

### POST `/api/v1/barcode/format`
Formats and cleans a barcode without validation or duplicate checking.

**Request Body:**
```json
{
  "barcode": "  bc:a1b2c3d4  "
}
```

**Response:**
```json
{
  "formatted_barcode": "BC-A1B2C3D4",
  "original_barcode": "  bc:a1b2c3d4  ",
  "format_applied": "Cleaned whitespace, normalized case, and applied standard pattern"
}
```

### GET `/api/v1/barcode/formats`
Returns information about supported barcode formats and validation rules.

## Usage

### In Sample Collection

1. **Regular Samples**: Click the "📷 Scan Barcode" button in the sample creation modal
2. **Lab Blanks**: Click "📷 Scan Lab Blank" in the blank samples section  
3. **Field Blanks**: Click "📷 Scan Field Blank" in the blank samples section

### CameraScanner Component Usage

```jsx
import CameraScanner from '../components/CameraScanner';

const MyComponent = () => {
  const [scannerOpen, setScannerOpen] = useState(false);
  
  const handleScan = (scannedCode) => {
    console.log('Scanned:', scannedCode);
    // Process the scanned barcode
  };
  
  return (
    <>
      <button onClick={() => setScannerOpen(true)}>
        📷 Scan Barcode
      </button>
      
      <CameraScanner
        isOpen={scannerOpen}
        onScan={handleScan}
        onClose={() => setScannerOpen(false)}
        title="Scan Sample Barcode"
        description="Point your camera at the barcode to scan it."
      />
    </>
  );
};
```

## Security & Permissions

### Frontend
- Requests camera permission from the user
- Graceful fallback when camera is not available
- Secure handling of camera streams (properly cleaned up)

### Backend  
- Requires authentication for all endpoints
- Role-based access control (technician level minimum)
- Input validation and sanitization
- SQL injection protection through parameterized queries

## Validation Rules

### Format Requirements
- Minimum length: 3 characters
- Maximum length: 50 characters
- Allowed characters: A-Z, 0-9, hyphens (-), periods (.)
- Case insensitive (automatically converted to uppercase)
- Whitespace and special characters are cleaned

### Business Rules
- Duplicate detection across all samples
- Context-aware validation (project/visit scope)
- Warnings for test/temporary barcodes
- Low entropy warnings (repeated characters)

## Error Handling

### Common Errors
1. **Camera Permission Denied**: Shows error message with retry button
2. **No Camera Found**: Displays appropriate error message
3. **Invalid Barcode Format**: Shows validation errors with specific messages
4. **Duplicate Barcode**: Warns about existing samples with context
5. **Network Errors**: Graceful handling with retry options

### Error Messages
- User-friendly error descriptions
- Specific validation guidance
- Contextual information for duplicates
- Technical details for developers (in console)

## Browser Compatibility

### Supported Browsers
- Chrome 53+ (recommended)
- Firefox 52+
- Safari 11+
- Edge 79+

### Mobile Support
- iOS Safari 11+
- Chrome Mobile 53+
- Samsung Internet 6.2+

### Required APIs
- `navigator.mediaDevices.getUserMedia()`
- `navigator.permissions.query()` (optional)
- WebRTC support for camera access

## Performance Considerations

### Frontend Optimization
- Lazy loading of ZXing library
- Efficient camera stream management
- Automatic cleanup of resources
- Optimized video constraints for scanning

### Backend Performance
- Fast barcode validation algorithms
- Efficient database queries for duplicates
- Minimal processing overhead
- Connection pooling for database access

## Testing

### Frontend Tests
- Component rendering tests
- Camera permission handling
- Scanning simulation
- Error state testing
- Resource cleanup verification

### Backend Tests
- Format validation functions
- API endpoint testing
- Authentication/authorization
- Database integration tests
- Error handling scenarios

## Installation Dependencies

### Frontend
```bash
npm install @zxing/library @zxing/browser
```

### Backend
No additional dependencies required (uses built-in Python libraries).

## Troubleshooting

### Camera Not Working
1. Check browser permissions for camera access
2. Ensure HTTPS connection (required for camera access)
3. Try refreshing the page
4. Check if camera is in use by another application

### Scanning Issues
1. Ensure good lighting conditions
2. Hold camera steady and at appropriate distance
3. Clean camera lens
4. Try different angles
5. Use torch/flashlight feature if available

### Format Issues
1. Check barcode format against supported patterns
2. Ensure minimum length requirements (3 characters)
3. Remove unsupported special characters
4. Check for duplicate barcodes in system

## Future Enhancements

### Planned Features
- Batch scanning support
- Custom format configuration
- Offline scanning capability
- Advanced image processing
- Analytics and usage metrics

### Possible Integrations
- Integration with existing barcode scanner hardware
- Export/import of barcode data
- Barcode generation functionality
- Integration with label printing systems