import os

# IMPORTANT: set required environment variables before importing the app/settings.
os.environ.setdefault("TESTING", "True")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test-refresh-secret-key")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_MINUTES", "43200")
os.environ.setdefault("ADMIN_CREATION_SECRET", "test-admin-secret")
os.environ.setdefault("ALLOWED_ORIGINS", "*")
os.environ.setdefault("BACKEND_PORT", "8000")
os.environ.setdefault("GOOGLE_MAPS_API_KEY", "test-google-maps-key")
os.environ.setdefault("REPORTS_STORAGE_DIR", "/tmp/reports")

# Database defaults (works in docker-compose where postgres is reachable as `db`).
os.environ.setdefault("POSTGRES_USER", "postgres")
os.environ.setdefault("POSTGRES_PASSWORD", "postgres")
os.environ.setdefault("POSTGRES_DB", "postgres")

# Force tests to use a dedicated test database derived from the configured DATABASE_URL.
# This avoids dropping/truncating the developer DB/volume.
if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = (
        f"postgresql://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}@db:5432/{os.environ['POSTGRES_DB']}"
    )

from urllib.parse import urlparse as _urlparse
_parsed = _urlparse(os.environ["DATABASE_URL"])
_base_db = (_parsed.path or "").lstrip("/") or os.environ.get("POSTGRES_DB", "postgres")
_test_db = f"{_base_db}_test"
os.environ["DATABASE_URL"] = _parsed._replace(path=f"/{_test_db}").geturl()

import asyncio
import logging
from typing import AsyncGenerator
from urllib.parse import urlparse

import pytest
from asyncpg import create_pool, Pool
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.user import UserCreate, UserResponse
from app.services.users import UserService
from app.services.roles import RoleService
from app.db.session import get_db
from app.db.migrate import run_migrations

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TEST_DATABASE_URL = settings.get_database_url


def _admin_dsn_from_test_dsn(test_dsn: str) -> tuple[str, str]:
    parsed = urlparse(test_dsn)
    db_name = (parsed.path or "").lstrip("/") or "test_db"

    # Preserve any URL encoding in credentials by reusing the parsed URL.
    admin_dsn = parsed._replace(path="/postgres").geturl()
    return admin_dsn, db_name


async def _create_test_database_async():
    """Create a clean test database and apply migrations."""
    admin_dsn, db_name = _admin_dsn_from_test_dsn(TEST_DATABASE_URL)

    default_pool = await create_pool(admin_dsn, command_timeout=60)
    try:
        async with default_pool.acquire() as conn:
            # Terminate any connections to allow DROP DATABASE.
            await conn.execute(
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = $1 AND pid <> pg_backend_pid();
                """,
                db_name,
            )
            await conn.execute(f'DROP DATABASE IF EXISTS "{db_name}"')
            await conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        await default_pool.close()

    await run_migrations()


@pytest.fixture(scope="session", autouse=True)
def create_test_database():
    # Avoid pytest-asyncio scope issues by running session setup in a dedicated loop.
    asyncio.run(_create_test_database_async())


@pytest.fixture
async def db_pool(create_test_database) -> AsyncGenerator[Pool, None]:
    pool = await create_pool(TEST_DATABASE_URL, command_timeout=60)
    try:
        yield pool
    finally:
        async with pool.acquire() as conn:
            # Reset data between tests. Keep the `roles` table (seeded by migrations).
            await conn.execute(
                """
                TRUNCATE TABLE
                    project_history,
                    field_counts,
                    analysis_runs,
                    batch_samples,
                    sample_batches,
                    sample_time_events,
                    samples,
                    reports,
                    project_visits,
                    project_technicians,
                    projects,
                    users,
                    companies,
                    user_roles
                RESTART IDENTITY CASCADE;
                """
            )
        await pool.close()


@pytest.fixture
async def client(db_pool) -> AsyncGenerator[AsyncClient, None]:
    async def get_pool():
        yield db_pool

    app.dependency_overrides[get_db] = get_pool
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=True,
        timeout=30.0,
    ) as c:
        yield c

    app.dependency_overrides.clear()


async def _create_user_with_roles(
    db_pool: Pool,
    *,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    role_names: list[str] | None = None,
    company_id: int | None = None,
) -> UserResponse:
    user_service = UserService(db_pool)
    role_service = RoleService(db_pool)

    user = await user_service.create_user(
        UserCreate(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            company_id=company_id,
        )
    )

    if role_names:
        await role_service.assign_roles(user.id, role_names, user.id)
        user = await user_service.get_user_by_id(user.id)
        assert user is not None

    return user


@pytest.fixture
async def normal_user(db_pool) -> UserResponse:
    return await _create_user_with_roles(
        db_pool,
        email="user@example.com",
        password="TestPass123!@#",
        first_name="Normal",
        last_name="User",
        role_names=None,
    )


@pytest.fixture
async def normal_user_token_headers(normal_user: UserResponse) -> dict:
    access_token = create_access_token(subject=normal_user.email)
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
async def admin_user(db_pool) -> UserResponse:
    return await _create_user_with_roles(
        db_pool,
        email="admin@example.com",
        password="AdminPass123!@#",
        first_name="Admin",
        last_name="User",
        role_names=["admin"],
    )


@pytest.fixture
async def admin_token_headers(admin_user: UserResponse) -> dict:
    access_token = create_access_token(subject=admin_user.email)
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
async def manager_user(db_pool) -> UserResponse:
    return await _create_user_with_roles(
        db_pool,
        email="manager@example.com",
        password="ManagerPass123!@#",
        first_name="Manager",
        last_name="User",
        role_names=["manager"],
    )


@pytest.fixture
async def manager_token_headers(manager_user: UserResponse) -> dict:
    access_token = create_access_token(subject=manager_user.email)
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
async def supervisor_user(db_pool) -> UserResponse:
    return await _create_user_with_roles(
        db_pool,
        email="supervisor@example.com",
        password="SupervisorPass123!@#",
        first_name="Supervisor",
        last_name="User",
        role_names=["supervisor"],
    )


@pytest.fixture
async def supervisor_token_headers(supervisor_user: UserResponse) -> dict:
    access_token = create_access_token(subject=supervisor_user.email)
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
async def field_tech_user(db_pool) -> UserResponse:
    return await _create_user_with_roles(
        db_pool,
        email="fieldtech@example.com",
        password="FieldTechPass123!@#",
        first_name="Field",
        last_name="Tech",
        role_names=["field_tech"],
    )


@pytest.fixture
async def field_tech_token_headers(field_tech_user: UserResponse) -> dict:
    access_token = create_access_token(subject=field_tech_user.email)
    return {"Authorization": f"Bearer {access_token}"}
