from typing import AsyncGenerator
from app.db.engine import get_connection
import asyncpg

async def get_db() -> AsyncGenerator[asyncpg.Pool, None]:
    """Dependency for getting database connection pool."""
    pool = await get_connection()
    try:
        yield pool
    finally:
        await pool.close()
