import asyncpg
from app.core.config import settings

# Create connection pool for raw SQL
async def get_connection():
    """Get a database connection from the pool."""
    return await asyncpg.create_pool(
        dsn=settings.get_database_url,
        min_size=1,
        max_size=10
    ) 