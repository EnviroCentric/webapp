# API Testing Rules

## General Requirements

### Test Structure
- All tests MUST be async with `@pytest.mark.asyncio`
- Tests MUST be self-contained
- Each test MUST create its own test data
- Tests MUST clean up after themselves
- Tests MUST be documented with clear docstrings
- Tests MUST follow the naming convention: `test_<functionality>_<scenario>`

### Test Organization
- Tests MUST be organized by endpoint/feature
- Related tests MUST be grouped together with clear section comments
- Test files MUST be placed in the appropriate directory structure:
  - API tests: `tests/api/v1/`
  - Service tests: `tests/services/`
  - Core tests: `tests/core/`

## Required Test Categories

### Authentication Tests
For each endpoint, test:
- Unauthorized access (401)
- Authorized access with valid token
- Authorized access with invalid token
- Token expiration handling
- Token refresh flow

### Input Validation Tests
For each endpoint, test:
- Valid input data
- Invalid input data (422)
- Missing required fields
- Invalid field types
- Field length/format validation
- Special character handling
- Empty/null value handling

### Business Logic Tests
For each endpoint, test:
- Success case
- Edge cases
- Error conditions
- Data integrity checks
- State transitions
- Business rule validations

## Endpoint-Specific Requirements

### GET Endpoints
Must test:
- Returns correct data structure
- Returns correct status code
- Handles non-existent resources (404)
- Handles query parameters
- Handles pagination (if applicable)
- Response format validation
- Data filtering (if applicable)
- Sorting (if applicable)

### POST/PUT Endpoints
Must test:
- Creates/updates resource successfully
- Returns correct response format
- Validates input data
- Handles duplicate data (if applicable)
- Updates related resources (if applicable)
- Partial updates (for PUT)
- Full updates (for PUT)
- Data transformation
- Default value handling

### DELETE Endpoints
Must test:
- Deletes resource successfully
- Returns correct status code
- Handles non-existent resources
- Handles related resource cleanup
- Cascading deletes (if applicable)
- Soft deletes (if applicable)

## Code Review Requirements

Before merging any endpoint:
1. All required test cases MUST be implemented
2. Tests MUST pass in isolation and together
3. No test data leaks between tests
4. Error cases MUST be properly handled
5. Edge cases MUST be covered
6. Database operations MUST be verified
7. Response formats MUST be validated
8. Authentication MUST be properly tested
9. Input validation MUST be comprehensive

## Test Data Management

### Test Data Creation
- Use fixtures for common test data
- Create unique test data for each test
- Use realistic test data
- Include edge case data
- Include invalid data scenarios

### Test Data Cleanup
- Clean up all created test data
- Handle cleanup in case of test failures
- Use database transactions where appropriate
- Reset state between tests

## Documentation Requirements

### Test Documentation
- Each test MUST have a clear docstring
- Complex test scenarios MUST include comments
- Test failures MUST be clearly documented
- Test dependencies MUST be documented
- Test data requirements MUST be documented

### Test Coverage
- All code paths MUST be tested
- All error conditions MUST be tested
- All edge cases MUST be tested
- All business rules MUST be tested
- All validation rules MUST be tested

## Continuous Integration

### CI Requirements
- All tests MUST pass in CI environment
- Test coverage MUST meet minimum requirements
- No decrease in test coverage allowed
- All new code MUST be covered by tests
- Tests MUST be fast and reliable

### Test Performance
- Tests MUST be optimized for speed
- Tests MUST not have unnecessary dependencies
- Tests MUST use appropriate mocking
- Tests MUST be parallelizable where possible

## Enforcement

### Pull Request Requirements
- Pull requests without tests will be rejected
- Incomplete test coverage will block merging
- Tests must pass all checks before merging
- All test requirements must be met before code review

### Quality Gates
- Minimum test coverage threshold: 80%
- All tests must pass
- No test flakiness allowed
- No test data leaks
- No test dependencies on external services 