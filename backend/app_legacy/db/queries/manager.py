from pathlib import Path
import re
from typing import Dict, Optional

class SQLQueryManager:
    def __init__(self):
        self._queries: Dict[str, str] = {}
        self._load_queries()

    def _load_queries(self):
        """Load all SQL queries from .sql files in the queries directory."""
        queries_dir = Path(__file__).parent
        for sql_file in queries_dir.glob("*.sql"):
            with open(sql_file, 'r') as f:
                content = f.read()
                # Extract named queries using regex
                query_blocks = re.finditer(
                    r'--\s*name:\s*(\w+)\s*\n(.*?)(?=\n--\s*name:|$)', 
                    content, 
                    re.DOTALL
                )
                for match in query_blocks:
                    name = match.group(1).strip()
                    query = match.group(2).strip()
                    self._queries[name] = query

    def get_query(self, name: str) -> Optional[str]:
        """Get a SQL query by name."""
        return self._queries.get(name)

    def __getattr__(self, name: str) -> str:
        """Allow accessing queries as attributes."""
        query = self.get_query(name)
        if query is None:
            raise AttributeError(f"Query '{name}' not found")
        return query

# Create a singleton instance
query_manager = SQLQueryManager() 