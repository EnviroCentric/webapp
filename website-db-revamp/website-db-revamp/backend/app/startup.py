import asyncio
import socket
import logging
from app.db.migrate import run_migrations

logger = logging.getLogger(__name__)

async def wait_for_db(host: str = "db", port: int = 5432, timeout: int = 30):
    """Wait for the database to be ready."""
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
            
        await asyncio.sleep(0.1)

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