from typing import Optional, List, Dict
from asyncpg import Pool
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserInDB
from app.core.security import get_password_hash, verify_password
from app.db.queries.manager import query_manager
import asyncpg

class UserService:
    def __init__(self, pool: Pool):
        self.pool = pool

    async def authenticate(self, email: str, password: str) -> Optional[UserInDB]:
        """Authenticate a user by email and password."""
        user = await self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    async def get_user_by_id(self, user_id: int) -> Optional[UserResponse]:
        """Get a user by their ID."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.get_user_by_id,
                user_id
            )
            return UserResponse(**dict(row)) if row else None

    async def create_user(self, user_in: UserCreate) -> UserResponse:
        """Create a new user."""
        hashed_password = get_password_hash(user_in.password)
        async with self.pool.acquire() as conn:
            user_id = await conn.fetchval(
                query_manager.create_user,
                user_in.company_id,
                user_in.email,
                hashed_password,
                user_in.first_name,
                user_in.last_name,
                user_in.phone,
                True,  # is_active
                False  # is_superuser
            )
            user = await self.get_user_by_id(user_id)
            if not user:
                raise ValueError("Failed to create user")
            return user

    async def get_user_by_email(self, email: str) -> Optional[UserInDB]:
        """Get a user by email."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.get_user_by_email,
                email
            )
            return UserInDB(**dict(row)) if row else None

    async def update_user(self, user_id: int, user_in: UserUpdate) -> Optional[UserResponse]:
        """Update a user's information."""
        # Convert UserUpdate to dict and filter out None values
        update_data = user_in.model_dump(exclude_unset=True)
        
        # Handle password hashing if it's being updated
        if 'password' in update_data:
            update_data['hashed_password'] = get_password_hash(update_data.pop('password'))
        
        # Get current user to ensure we have all fields
        current_user = await self.get_user_by_id(user_id)
        if not current_user:
            return None

        # Prepare parameters for the update query
        params = [
            user_id,  # $1
            update_data.get('company_id', None),  # $2
            update_data.get('email', None),  # $3
            update_data.get('hashed_password', None),  # $4
            update_data.get('first_name', None),  # $5
            update_data.get('last_name', None),  # $6
            update_data.get('phone', None),  # $7
            update_data.get('is_active', current_user.is_active),  # $8
            update_data.get('is_superuser', current_user.is_superuser),  # $9
        ]

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.update_user,
                *params
            )
            return UserResponse(**dict(row)) if row else None

    async def create_superuser(self, user_in: UserCreate) -> UserResponse:
        """Create a new superuser."""
        hashed_password = get_password_hash(user_in.password)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                try:
                    # Create the user (superusers don't belong to any company)
                    user_id = await conn.fetchval(
                        query_manager.create_user,
                        None,  # company_id (superusers are system users)
                        user_in.email,
                        hashed_password,
                        user_in.first_name,
                        user_in.last_name,
                        user_in.phone,
                        True,   # is_active
                        True    # is_superuser
                    )
                    
                    # Get or create admin role
                    admin_role = await conn.fetchrow(
                        query_manager.get_or_create_admin_role
                    )
                    if not admin_role:
                        raise ValueError("Failed to get or create admin role")
                    
                    # Assign admin role to superuser
                    await conn.execute(
                        query_manager.insert_user_role,
                        user_id,
                        admin_role['id']
                    )
                    
                    # Update the user's highest_level field based on their roles
                    await conn.execute(
                        query_manager.recalc_user_highest_role_level,
                        user_id
                    )
                    
                    # Fetch the created user with roles
                    user = await conn.fetchrow(
                        query_manager.get_user_by_id,
                        user_id
                    )
                    if not user:
                        raise ValueError("Failed to fetch created superuser")
                    return UserResponse(**dict(user))
                except Exception as e:
                    # Log the error for debugging
                    print(f"Error creating superuser: {str(e)}")
                    raise ValueError(f"Failed to create superuser: {str(e)}")

    async def get_all_users(self) -> List[UserResponse]:
        """Get all users."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.get_all_users)
            return [UserResponse(**dict(row)) for row in rows]
    
    async def get_users_by_min_role_level(self, min_level: int) -> List[UserResponse]:
        """Get all active users with role level >= min_level."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.get_users_by_min_role_level, min_level)
            return [UserResponse(**dict(row)) for row in rows]
    
    async def get_employees_minimal(self, min_level: int) -> List[dict]:
        """Get minimal employee data (id, name, roles) with role level >= min_level."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.get_employees_minimal, min_level)
            return [dict(row) for row in rows]
    
    async def get_user_by_id_with_password(self, user_id: int) -> Optional[UserInDB]:
        """Get a user by ID including their hashed password."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.get_user_by_id_with_password,
                user_id
            )
            return UserInDB(**dict(row)) if row else None
    
    async def update_user_password(self, user_id: int, hashed_password: str) -> bool:
        """Update a user's password."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                query_manager.update_user_password,
                user_id, hashed_password
            )
            # Check if any row was affected
            return result.split()[-1] == '1'
