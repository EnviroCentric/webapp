#!/usr/bin/env python3
"""
Script to normalize user names to lowercase.
This script can be run manually to apply the name normalization migration.
"""
import asyncio
import asyncpg
import os
import sys

# Add the backend app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.config import settings

async def normalize_user_names():
    """Normalize existing user names to lowercase."""
    try:
        # Create database connection
        conn = await asyncpg.connect(settings.get_database_url)
        
        # Get count of users that need normalization
        count_query = """
        SELECT COUNT(*) 
        FROM users 
        WHERE first_name != LOWER(first_name) OR last_name != LOWER(last_name)
        """
        
        users_to_update = await conn.fetchval(count_query)
        print(f"Found {users_to_update} users with names that need normalization")
        
        if users_to_update > 0:
            # Show examples of what will be changed
            preview_query = """
            SELECT id, first_name, last_name, 
                   LOWER(first_name) as new_first_name, 
                   LOWER(last_name) as new_last_name
            FROM users 
            WHERE first_name != LOWER(first_name) OR last_name != LOWER(last_name)
            ORDER BY id
            LIMIT 5
            """
            
            preview_results = await conn.fetch(preview_query)
            print("\nPreview of changes (showing first 5):")
            print("ID | Current Name -> New Name")
            print("-" * 50)
            for row in preview_results:
                current = f"{row['first_name']} {row['last_name']}"
                new = f"{row['new_first_name']} {row['new_last_name']}"
                print(f"{row['id']:2} | {current} -> {new}")
            
            # Confirm with user
            if len(preview_results) < users_to_update:
                print(f"\n... and {users_to_update - len(preview_results)} more users")
            
            confirm = input(f"\nProceed with normalizing {users_to_update} user names? (y/N): ")
            if confirm.lower() not in ['y', 'yes']:
                print("Operation cancelled")
                return
            
            # Run the normalization
            update_query = """
            UPDATE users 
            SET 
                first_name = LOWER(first_name),
                last_name = LOWER(last_name),
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                first_name != LOWER(first_name) OR 
                last_name != LOWER(last_name)
            """
            
            result = await conn.execute(update_query)
            updated_count = int(result.split()[-1])
            
            print(f"✅ Successfully normalized {updated_count} user names to lowercase")
            
            # Show some examples after update
            sample_query = """
            SELECT id, first_name, last_name 
            FROM users 
            ORDER BY updated_at DESC 
            LIMIT 5
            """
            
            samples = await conn.fetch(sample_query)
            print("\nSample of recently updated users:")
            for row in samples:
                print(f"{row['id']:2} | {row['first_name']} {row['last_name']}")
                
        else:
            print("✅ All user names are already normalized to lowercase")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    print("🔄 Starting user name normalization...")
    asyncio.run(normalize_user_names())
    print("✅ Name normalization complete!")