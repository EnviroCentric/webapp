from typing import Optional, List
from asyncpg import Pool
from app.schemas.role import RoleCreate, RoleUpdate, RoleResponse
from app.db.queries.manager import query_manager

async def get_user_role_level(pool: Pool, user_id: int) -> int:
    """Get the highest role level for a user."""
    async with pool.acquire() as conn:
        level = await conn.fetchval("""
            SELECT COALESCE(MAX(r.level), 0)
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
        """, user_id)
        return level

class RoleService:
    def __init__(self, pool: Pool):
        self.pool = pool

    async def get_all_roles(self) -> List[RoleResponse]:
        """Get all roles."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query_manager.get_all_roles)
            return [RoleResponse(**dict(row)) for row in rows]

    async def get_role_by_id(self, role_id: int) -> Optional[RoleResponse]:
        """Get a role by ID."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query_manager.get_role_by_id, role_id)
            return RoleResponse(**dict(row)) if row else None

    async def create_role(self, role_in: RoleCreate) -> RoleResponse:
        """Create a new role."""
        async with self.pool.acquire() as conn:
            role_id = await conn.fetchval(
                query_manager.create_role,
                role_in.name,
                role_in.description,
                role_in.level
            )
            role = await self.get_role_by_id(role_id)
            if not role:
                raise ValueError("Failed to create role")
            return role

    async def update_role(self, role_id: int, role_in: RoleUpdate) -> Optional[RoleResponse]:
        """Update a role."""
        update_data = role_in.model_dump(exclude_unset=True)
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query_manager.update_role,
                role_id,
                update_data.get('name'),
                update_data.get('description'),
                update_data.get('level')
            )
            return RoleResponse(**dict(row)) if row else None

    async def delete_role(self, role_id: int) -> bool:
        """Delete a role."""
        async with self.pool.acquire() as conn:
            result = await conn.execute(query_manager.delete_role, role_id)
            return result == "DELETE 1"

    async def assign_roles(self, user_id: int, role_names: List[str], assigned_by: int) -> None:
        """Assign roles to a user."""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Get role IDs for the given role names
                role_ids = []
                for role_name in role_names:
                    role = await conn.fetchrow(
                        query_manager.get_role_by_name,
                        role_name
                    )
                    if not role:
                        raise ValueError(f"Role '{role_name}' not found")
                    role_ids.append(role['id'])

                # Assign each role to the user
                for role_id in role_ids:
                    await conn.execute(
                        query_manager.insert_user_role,
                        user_id,
                        role_id
                    ) 