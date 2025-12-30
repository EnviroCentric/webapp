from pathlib import Path
import os
from app.db.queries.manager import SQLQueryManager

# Get the directory containing this file
QUERIES_DIR = Path(__file__).parent

def load_sql(filename: str) -> str:
    """Load SQL from a file in the queries directory."""
    file_path = QUERIES_DIR / filename
    with open(file_path, 'r') as f:
        return f.read()

# Create a query manager instance
query_manager = SQLQueryManager()

# Expose queries as module-level variables
users = query_manager
roles = query_manager
projects = query_manager
samples = query_manager
manager = query_manager 