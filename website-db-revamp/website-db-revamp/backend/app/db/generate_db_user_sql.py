import os
import psycopg2

# Read environment variables
POSTGRES_USER = os.getenv('POSTGRES_USER')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
POSTGRES_DB = os.getenv('POSTGRES_DB')
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')

if not POSTGRES_USER or not POSTGRES_PASSWORD or not POSTGRES_DB:
    raise ValueError('POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB must be set in the environment.')

# SQL to create role and grant privileges
sql = f"""
DO
$$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles WHERE rolname = '{POSTGRES_USER}'
   ) THEN
      CREATE ROLE "{POSTGRES_USER}" WITH LOGIN PASSWORD '{POSTGRES_PASSWORD}';
   END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE "{POSTGRES_DB}" TO "{POSTGRES_USER}";
"""

def main():
    # Connect as the superuser (usually 'postgres')
    admin_user = os.getenv('POSTGRES_ADMIN_USER', 'postgres')
    admin_password = os.getenv('POSTGRES_ADMIN_PASSWORD', POSTGRES_PASSWORD)
    conn = psycopg2.connect(
        dbname=POSTGRES_DB,
        user=admin_user,
        password=admin_password,
        host=POSTGRES_HOST,
        port=POSTGRES_PORT
    )
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            print(f"Executed SQL to create role '{POSTGRES_USER}' and grant privileges on '{POSTGRES_DB}'.")
    finally:
        conn.close()

if __name__ == "__main__":
    main() 