import pytest
import logging
import asyncio
import os
from typing import AsyncGenerator, Generator
from asyncpg import create_pool, Pool
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.schemas.user import UserCreate, UserResponse
from app.services.users import UserService
from app.services.roles import RoleService
from app.db.session import get_db

# Set test environment
os.environ["TESTING"] = "True"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"
os.environ["JWT_REFRESH_SECRET_KEY"] = "test-refresh-secret-key"

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Test database URL
TEST_DATABASE_URL = settings.get_database_url

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
async def create_test_database():
    """Create test database and tables."""
    # Connect to default database to create test database
    default_pool = await create_pool(
        settings.get_database_url.replace("/test_db", "/postgres"),
        command_timeout=60
    )
    
    async with default_pool.acquire() as conn:
        # Drop test database if it exists
        await conn.execute("DROP DATABASE IF EXISTS test_db")
        # Create test database
        await conn.execute("CREATE DATABASE test_db")
    
    await default_pool.close()
    
    # Create tables in test database using migrations
    from app.db.migrate import run_migrations
    await run_migrations()

@pytest.fixture
async def db_pool(create_test_database) -> AsyncGenerator[Pool, None]:
    """Create a fresh database pool for each test."""
    pool = await create_pool(TEST_DATABASE_URL, command_timeout=60)
    
    # Set up test data BEFORE yielding the pool
    async with pool.acquire() as conn:
        # Try to recreate basic roles if the tables exist
        try:
            # Re-insert default roles if the table exists
            await conn.execute("""
                INSERT INTO roles (name, description, level)
                VALUES
                    ('admin', 'Administrator with full system access', 100),
                    ('manager', 'Manager with elevated access', 90),
                    ('supervisor', 'Supervisor with team management access', 80),
                    ('technician', 'Technician with project management access', 50)
                ON CONFLICT (name) DO UPDATE SET level = EXCLUDED.level
            """)
        except Exception:
            # Roles table doesn't exist, skip it
            pass
            
        # Try to create a test company if the table exists
        try:
            await conn.execute("""
                INSERT INTO companies (name, city, state)
                VALUES ('Test Company', 'Test City', 'Test State')
            """)
        except Exception:
            # Companies table doesn't exist, skip it
            pass
    
    yield pool
    
    # Clean up the tables after each test
    async with pool.acquire() as conn:
        await conn.execute("DROP VIEW IF EXISTS user_roles_with_permissions")
        # Only truncate tables that exist
        tables_to_clean = [
            "project_technicians", "projects", "addresses", 
            "user_roles", "role_permissions", "permissions", "roles", "users", "companies"
        ]
        for table in tables_to_clean:
            try:
                await conn.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")
            except Exception:
                # Table doesn't exist yet, skip it
                pass
    
    await pool.close()

@pytest.fixture
async def client(db_pool) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with a fresh database pool."""
    async def get_pool():
        yield db_pool
    
    app.dependency_overrides[get_db] = get_pool
    
    # Create a test client that connects to the test server
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=True,
        timeout=30.0
    ) as client:
        yield client
    
    app.dependency_overrides.clear()

@pytest.fixture
async def test_user(db_pool) -> UserResponse:
    """Create a test user."""
    user_service = UserService(db_pool)
    
    # Get the test company ID
    async with db_pool.acquire() as conn:
        company_row = await conn.fetchrow("SELECT id FROM companies WHERE name = 'Test Company'")
        company_id = company_row['id'] if company_row else None
    
    user_data = UserCreate(
        email="test@example.com",
        password="TestPass123!@#",
        first_name="Test",
        last_name="User",
        is_active=True,
        is_superuser=False,
        company_id=company_id  # Assign to test company dynamically
    )
    user = await user_service.create_user(user_data)
    return user

@pytest.fixture
async def normal_user_token_headers(client: AsyncClient, test_user: UserResponse):
    """Create a test user and return its token headers."""
    login_data = {
        "username": test_user.email,
        "password": "TestPass123!@#"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}

@pytest.fixture
async def superuser_token_headers(db_pool) -> dict:
    """Create a superuser and return their auth headers."""
    user_service = UserService(db_pool)
    user_in = UserCreate(
        email="superuser@example.com",
        password="TestPass123!@#",
        first_name="Super",
        last_name="User",
        is_active=True,
        is_superuser=True
    )
    user = await user_service.create_superuser(user_in)
    access_token = create_access_token(
        subject=user.email,
        additional_claims={"is_superuser": True}
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
async def admin_token_headers(db_pool):
    """Create headers with an admin user token (has manage_users permission)."""
    user_service = UserService(db_pool)
    user_data = UserCreate(
        email="admin@example.com",
        password="AdminPass123!@#",
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_superuser=False
    )
    user = await user_service.create_user(user_data)
    async with db_pool.acquire() as conn:
        # Get admin role id
        admin_role = await conn.fetchrow("SELECT id, name FROM roles WHERE name = 'admin'")
        if admin_role is None:
            raise RuntimeError("Admin role not found in test database. Check test DB setup.")
        # Assign admin role to user
        await conn.execute(
            """
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
            """,
            user.id, admin_role['id']
        )
        # Update user's highest_level field to match admin role level
        admin_role_level = await conn.fetchval("SELECT level FROM roles WHERE id = $1", admin_role['id'])
        await conn.execute(
            "UPDATE users SET highest_level = $1 WHERE id = $2",
            admin_role_level, user.id
        )
        # Debug: check user_roles assignment
        user_roles = await conn.fetch("SELECT * FROM user_roles WHERE user_id = $1", user.id)
        print(f"[DEBUG] user_roles for admin user: {user_roles}")
    access_token = create_access_token(
        subject=user.email,
        additional_claims={
            "is_superuser": False,
            "roles": [{
                "id": admin_role['id'],
                "name": admin_role['name']
            }]
        }
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
async def technician_user(db_pool):
    """Create a test technician user."""
    user_service = UserService(db_pool)
    role_service = RoleService(db_pool)
    user_data = UserCreate(
        email="technician@test.com",
        password="TestPass123!",
        first_name="Test",
        last_name="Technician"
    )
    user = await user_service.create_user(user_data)
    
    # Assign technician role
    await role_service.assign_roles(user.id, ["technician"], user.id)
    
    return user

@pytest.fixture
async def technician_token_headers(client: AsyncClient, technician_user: UserResponse):
    """Get token headers for technician user."""
    access_token = create_access_token(subject=technician_user.email)
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
async def admin_user(db_pool):
    """Create an admin user for testing."""
    user_service = UserService(db_pool)
    user_data = UserCreate(
        email="admin@test.com",
        password="TestPass123!",
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_superuser=False
    )
    user = await user_service.create_user(user_data)
    
    # Assign admin role
    role_service = RoleService(db_pool)
    await role_service.assign_roles(user.id, ["admin"], user.id)
    
    return user

@pytest.fixture
async def supervisor_user(db_pool):
    """Create a supervisor user for testing."""
    user_service = UserService(db_pool)
    user_data = UserCreate(
        email="supervisor@test.com",
        password="TestPass123!",
        first_name="Supervisor",
        last_name="User",
        is_active=True,
        is_superuser=False
    )
    user = await user_service.create_user(user_data)
    
    # Assign supervisor role
    role_service = RoleService(db_pool)
    await role_service.assign_roles(user.id, ["supervisor"], user.id)
    
    return user

@pytest.fixture
async def supervisor_token_headers(db_pool):
    """Create headers with a supervisor user token."""
    user_service = UserService(db_pool)
    
    # Get the test company ID
    async with db_pool.acquire() as conn:
        company_row = await conn.fetchrow("SELECT id FROM companies WHERE name = 'Test Company'")
        company_id = company_row['id'] if company_row else None
    
    user_data = UserCreate(
        email="supervisor@example.com",
        password="SupervisorPass123!@#",
        first_name="Supervisor",
        last_name="User",
        is_active=True,
        is_superuser=False,
        company_id=company_id
    )
    user = await user_service.create_user(user_data)
    
    async with db_pool.acquire() as conn:
        # Get supervisor role id
        supervisor_role = await conn.fetchrow("SELECT id, name FROM roles WHERE name = 'supervisor'")
        if supervisor_role is None:
            raise RuntimeError("Supervisor role not found in test database. Check test DB setup.")
        # Assign supervisor role to user
        await conn.execute(
            """
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
            """,
            user.id, supervisor_role['id']
        )
        # Update user's highest_level field to match supervisor role level
        supervisor_role_level = await conn.fetchval("SELECT level FROM roles WHERE id = $1", supervisor_role['id'])
        await conn.execute(
            "UPDATE users SET highest_level = $1 WHERE id = $2",
            supervisor_role_level, user.id
        )
    
    access_token = create_access_token(
        subject=user.email,
        additional_claims={
            "is_superuser": False,
            "roles": [{
                "id": supervisor_role['id'],
                "name": supervisor_role['name']
            }]
        }
    )
    return {"Authorization": f"Bearer {access_token}"}
