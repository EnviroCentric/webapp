from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
import logging
import time
from app.core.config import settings
from app.api.v1 import auth, users, roles, projects, samples, companies, laboratory, reports, barcode
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

# Define API tags metadata for better documentation organization
tags_metadata = [
    {
        "name": "Authentication",
        "description": "User authentication and token management operations.",
    },
    {
        "name": "User Management",
        "description": "User account creation, updates, and role assignments. Requires appropriate permissions.",
    },
    {
        "name": "Role Management",
        "description": "Role creation, updates, and permission management. Admin-level operations.",
    },
    {
        "name": "Company Management",
        "description": "Client company management and organizational structure operations.",
    },
    {
        "name": "Project Management",
        "description": "Project lifecycle management, site visits, and technician assignments.",
    },
    {
        "name": "Sample Management",
        "description": "Environmental sample creation, tracking, and status management.",
    },
    {
        "name": "Laboratory Workflow",
        "description": "Laboratory operations including sample batching, analysis runs, results, QA reviews, and methods.",
    },
    {
        "name": "Report Management",
        "description": "Report generation, finalization, and client access management.",
    },
    {
        "name": "Barcode Scanning",
        "description": "Barcode and QR code validation, formatting, and scanning operations.",
    },
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Laboratory Information Management System (LIMS) API for environmental testing workflows.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    version="1.0.0",
    openapi_tags=tags_metadata,
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log basic request information."""
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
    
    return response

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Authorization", 
        "Content-Type", 
        "Accept", 
        "Origin", 
        "User-Agent",
        "DNT",
        "Cache-Control",
        "X-Requested-With",
        "If-Modified-Since",
        "If-None-Match"
    ],
    expose_headers=["*"],
    max_age=600
)

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth")
app.include_router(users.router, prefix=f"{settings.API_V1_STR}")
app.include_router(roles.router, prefix=f"{settings.API_V1_STR}")
app.include_router(companies.router, prefix=f"{settings.API_V1_STR}/companies")
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects")
app.include_router(samples.router, prefix=f"{settings.API_V1_STR}")
app.include_router(laboratory.router, prefix=f"{settings.API_V1_STR}/laboratory")
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports")
app.include_router(barcode.router, prefix=f"{settings.API_V1_STR}/barcode")

# Add OPTIONS handlers for specific common endpoints to support CORS
# without interfering with 404 responses for truly non-existent endpoints
@app.options(f"{settings.API_V1_STR}/auth/login")
@app.options(f"{settings.API_V1_STR}/auth/register")
@app.options(f"{settings.API_V1_STR}/auth/me")
@app.options(f"{settings.API_V1_STR}/users/me")
@app.options(f"{settings.API_V1_STR}/users/")
@app.options(f"{settings.API_V1_STR}/roles/")
@app.options(f"{settings.API_V1_STR}/companies/")
@app.options(f"{settings.API_V1_STR}/projects/")
@app.options(f"{settings.API_V1_STR}/samples/")
@app.options(f"{settings.API_V1_STR}/samples/visit/{{visit_id}}")
@app.options(f"{settings.API_V1_STR}/reports/")
@app.options(f"{settings.API_V1_STR}/laboratory/samples")
@app.options(f"{settings.API_V1_STR}/laboratory/batches")
@app.options(f"{settings.API_V1_STR}/laboratory/runs")
@app.options(f"{settings.API_V1_STR}/laboratory/methods")
async def options_handler(request: Request):
    """Handle OPTIONS requests for CORS preflight on specific endpoints."""
    
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, User-Agent, Cache-Control",
            "Access-Control-Max-Age": "86400"
        }
    )

@app.on_event("startup")
async def startup_event():
    """Run startup tasks when the application starts."""
    await startup()
    pool = await asyncpg.create_pool(settings.get_database_url)
    async with pool.acquire() as conn:
        # Create user_roles view
        await conn.execute(query_manager.create_user_roles_view)
    await pool.close()

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up database objects on shutdown."""
    pool = await asyncpg.create_pool(settings.get_database_url)
    async with pool.acquire() as conn:
        await conn.execute(query_manager.drop_user_roles_view)
    await pool.close()

@app.get("/")
async def root():
    return {"message": "Welcome to the API"}

logging.getLogger("passlib.handlers.bcrypt").setLevel(logging.ERROR)
