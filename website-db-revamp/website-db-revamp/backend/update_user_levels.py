"""
Script to update the highest_level field for all users based on their actual roles.
Run this to fix the issue with employees not showing up in the project modal.
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def update_all_user_highest_levels():
    # Use DATABASE_URL if available (Docker), otherwise fallback to individual env vars
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        conn = await asyncpg.connect(database_url)
    else:
        conn = await asyncpg.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', 5432),
            user=os.getenv('POSTGRES_USER', os.getenv('DB_USER')),
            password=os.getenv('POSTGRES_PASSWORD', os.getenv('DB_PASS')),
            database=os.getenv('POSTGRES_DB', os.getenv('DB_NAME'))
        )
    
    try:
        # Update all users' highest_level fields based on their roles
        result = await conn.execute('''
            UPDATE users 
            SET highest_level = COALESCE(
                (SELECT MAX(r.level) 
                 FROM user_roles ur 
                 JOIN roles r ON ur.role_id = r.id 
                 WHERE ur.user_id = users.id), 
                0
            )
        ''')
        
        print(f"Updated highest_level for users: {result}")
        
        # Show the results
        users = await conn.fetch('''
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.is_superuser,
                u.highest_level,
                string_agg(r.name, ', ') as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.is_active = true
            GROUP BY u.id, u.first_name, u.last_name, u.is_superuser, u.highest_level
            ORDER BY u.highest_level DESC, u.first_name
        ''')
        
        print("\nUpdated users:")
        print("-" * 80)
        for user in users:
            name = f"{user['first_name']} {user['last_name']}"
            super_status = "Super" if user['is_superuser'] else ""
            roles = user['roles'] or "None"
            print(f"ID: {user['id']:2} | {name:20} | Level: {user['highest_level']:3} | {super_status:5} | Roles: {roles}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(update_all_user_highest_levels())