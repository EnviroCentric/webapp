# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Environment

This is a full-stack environmental management web application with three main components:
- **Backend**: FastAPI-based REST API with PostgreSQL database
- **Frontend**: React + Vite with Tailwind CSS
- **Infrastructure**: AWS CDK for cloud deployment

## Development Commands

### Docker Development (Primary)
```bash
# Start all services (database, backend, frontend)
docker-compose up -d

# View logs
docker-compose logs -f [backend|frontend|db]

# Stop all services
docker-compose down

# Rebuild after changes
docker-compose up --build
```

### Backend Commands
```bash
# Run backend directly (requires PostgreSQL running)
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests with coverage
cd backend
pytest --cov=app tests/

# Run specific test
cd backend
pytest tests/api/v1/test_auth.py::test_login_success

# Run async tests
cd backend
pytest -m asyncio tests/

# Create superuser
docker compose exec backend python -m app.core.init_superuser

# Check database migrations
cd backend
python -c "from app.db.migrate import run_migrations; import asyncio; asyncio.run(run_migrations())"
```

### Frontend Commands
```bash
# Development server
cd frontend
npm run dev

# Build for production
cd frontend
npm run build

# Run tests
cd frontend
npm run test

# Run tests in watch mode
cd frontend
npm run test:watch

# Run tests with coverage
cd frontend
npm run test:coverage

# Lint code
cd frontend
npm run lint

# Deploy to AWS
cd frontend
npm run deploy
```

### Infrastructure Commands
```bash
# Build TypeScript
cd infrastructure
npm run build

# Deploy to AWS
cd infrastructure
npm run deploy

# Destroy infrastructure
cd infrastructure
npm run destroy
```

## Architecture Overview

### Backend Architecture (FastAPI)
- **Entry Point**: `app/main.py` - FastAPI application setup with CORS, middleware, and routing
- **API Structure**: 
  - `app/api/v1/` - API endpoints organized by feature (auth, users, roles, projects, samples)
  - All endpoints follow RESTful conventions
- **Data Layer**:
  - `app/schemas/` - Pydantic models for request/response validation
  - `app/db/` - Database connection, queries, and migrations
  - Uses asyncpg for PostgreSQL connections
- **Services**: `app/services/` - Business logic layer
- **Core**: `app/core/` - Configuration, security, and utilities
- **Database**: PostgreSQL with custom migration system in `app/db/migrate.py`

### Frontend Architecture (React)
- **Entry Point**: `src/main.jsx` - React app initialization with context providers
- **Routing**: React Router v6 with protected routes in `src/routes/`
- **State Management**: React Context API for:
  - `AuthContext` - Authentication state and JWT token management
  - `ThemeContext` - Dark/light theme switching
  - `RolesContext` - User roles and permissions
- **UI Components**: `src/components/` - Reusable components with Tailwind CSS
- **Pages**: `src/pages/` - Route-level components
- **Services**: `src/services/` - API communication layer
- **Hooks**: `src/hooks/` - Custom React hooks

### Domain Model
This is an environmental management system with the following core entities:
- **Projects**: Top-level containers for environmental sampling work
- **Addresses**: Specific locations within projects where samples are collected
- **Samples**: Individual environmental samples with metadata (cassette barcodes, flow rates, timing)
- **Users**: System users with role-based access control
- **Roles**: Define permissions for different user types (technicians, admins, etc.)

### Authentication
- JWT-based authentication with access/refresh token pattern
- Role-based access control (RBAC) system
- Protected routes in frontend, middleware authorization in backend

## Testing Requirements

### Backend Testing (pytest + asyncio)
All new API endpoints MUST have comprehensive test coverage including:
- **Authentication**: 401/403 scenarios, valid/invalid tokens
- **Input Validation**: Valid data, 422 errors, missing fields, type validation
- **Business Logic**: Success cases, edge cases, error conditions
- **Database Operations**: CRUD operations, data integrity, cleanup

Test structure requirements:
- All tests MUST be async with `@pytest.mark.asyncio`
- Tests MUST be self-contained and create their own test data
- Tests MUST clean up after themselves
- Follow naming: `test_<functionality>_<scenario>`
- Organization: `tests/api/v1/`, `tests/services/`, `tests/core/`

### Frontend Testing (Vitest + Testing Library)
- Component tests using React Testing Library
- Integration tests for user workflows
- API service tests with mocked endpoints

## Environment Configuration

- Environment variables managed in `.env` file
- Database: PostgreSQL with connection pooling
- Development ports: Backend 8000, Frontend 5173, Database 15432
- CORS configured for `http://localhost:5173`

## Database

- PostgreSQL 15 with custom migration system
- Migrations in `backend/app/db/migrations/` (SQL files)
- Auto-migration on application startup
- Connection pooling with asyncpg

## Key Development Rules

### API Development
- Every new endpoint MUST have corresponding tests BEFORE merge
- Minimum 80% test coverage required
- All endpoints must handle authentication and authorization
- Input validation using Pydantic schemas
- Async/await pattern throughout backend

### Code Quality
- Backend: Follow FastAPI best practices, use type hints
- Frontend: Use React hooks, proper error boundaries
- Database: All schema changes via migrations
- No test data leaks between tests
- All business logic rules must be tested

### Authentication & Authorization
- JWT tokens for API authentication
- Role-based permissions system
- Protected routes in frontend
- All endpoints validate user permissions

## Deployment

- AWS-based infrastructure using CDK
- Docker containers for development and production
- S3 + CloudFront for frontend static hosting
- RDS PostgreSQL for production database