import os
import logging
import hashlib
from app.db.engine import get_connection

logger = logging.getLogger(__name__)

def split_sql_statements(sql: str) -> list[str]:
    """Split SQL file into individual statements."""
    # Remove comments
    lines = []
    for line in sql.split('\n'):
        if not line.strip().startswith('--'):
            lines.append(line)
    
    # Join lines and split by semicolon
    sql_no_comments = '\n'.join(lines)
    statements = [stmt.strip() for stmt in sql_no_comments.split(';') if stmt.strip()]
    return statements

def calculate_checksum(content: str) -> str:
    """Calculate SHA-256 checksum of content."""
    return hashlib.sha256(content.encode()).hexdigest()

async def run_migrations():
    """Run all SQL migrations in the migrations directory."""
    migrations_dir = os.path.join(os.path.dirname(__file__), "migrations")
    
    # Get all SQL files and sort them
    migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])
    
    # Create connection pool
    pool = await get_connection()
    
    try:
        async with pool.acquire() as conn:
            # First, ensure migrations table exists
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS migrations (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    checksum VARCHAR(64) NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(name);
            """)
            
            for migration_file in migration_files:
                # Check if migration has already been applied
                applied = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM migrations WHERE name = $1)",
                    migration_file
                )
                
                if applied:
                    logger.info(f"Skipping already applied migration: {migration_file}")
                    continue
                
                logger.info(f"Running migration: {migration_file}")
                file_path = os.path.join(migrations_dir, migration_file)
                
                with open(file_path, 'r') as f:
                    sql = f.read()
                
                # Calculate checksum of migration file
                checksum = calculate_checksum(sql)
                
                # Split SQL into individual statements
                statements = split_sql_statements(sql)
                
                # Execute each statement separately
                for statement in statements:
                    if statement:  # Skip empty statements
                        await conn.execute(statement)
                
                # Record the migration
                await conn.execute(
                    "INSERT INTO migrations (name, checksum) VALUES ($1, $2)",
                    migration_file, checksum
                )
                
                logger.info(f"Completed migration: {migration_file}")
    finally:
        await pool.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_migrations()) 