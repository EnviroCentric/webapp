import asyncio
import socket
import logging
from urllib.parse import urlparse
from app.db.migrate import run_migrations
from app.core.config import settings

logger = logging.getLogger(__name__)

async def wait_for_db(host: str | None = None, port: int | None = None, timeout: int = 60):
    """Wait for the database to be ready."""
    parsed = urlparse(settings.get_database_url)
    host = host or parsed.hostname or "db"
    port = port or parsed.port or 5432
    start_time = asyncio.get_event_loop().time()
    while True:
        try:
            # Try to connect to the database
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex((host, port))
            sock.close()
            
            if result == 0:
                logger.info("Database is ready!")
                return True
                
        except Exception as e:
            logger.debug(f"Database not ready: {e}")
            
        # Check if we've exceeded the timeout
        if asyncio.get_event_loop().time() - start_time > timeout:
            raise TimeoutError(f"Database not ready after {timeout} seconds")
            
        await asyncio.sleep(1)

async def startup():
    """Run startup tasks."""
    try:
        # Wait for database
        logger.info("Waiting for database to be ready...")
        await wait_for_db()
        
        # Run migrations
        logger.info("Running migrations...")
        await run_migrations()
        
        logger.info("Startup completed successfully!")
        
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise
