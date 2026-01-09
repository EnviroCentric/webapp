from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.core.config import settings
from app.api.v1 import auth, users, roles, projects, samples
from app.startup import startup
from app.db.session import get_db
from app.db.queries.manager import query_manager
import asyncpg

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    version="1.0.0",
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth")
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(roles.router, prefix=settings.API_V1_STR)
app.include_router(projects.router, prefix=settings.API_V1_STR)
app.include_router(samples.router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def startup_event():
    """Run startup tasks when the application starts."""
    await startup()
    pool = await asyncpg.create_pool(settings.get_database_url)
    async with pool.acquire() as conn:
        # Create user_roles_with_permissions view
        await conn.execute(query_manager.create_user_roles_with_permissions_view)
    await pool.close()

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up database objects on shutdown."""
    pool = await asyncpg.create_pool(settings.get_database_url)
    async with pool.acquire() as conn:
        await conn.execute(query_manager.drop_user_roles_with_permissions_view)
    await pool.close()

@app.get("/")
async def root():
    return {"message": "Welcome to the API"}

logging.getLogger("passlib.handlers.bcrypt").setLevel(logging.ERROR)
