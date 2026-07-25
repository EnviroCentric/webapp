"""Seed the preserved local user 1 into an otherwise empty production DB.

The JSON payload is read from stdin so the password hash is never passed as a
command-line argument or written to disk.
"""

import asyncio
import json
import sys
from datetime import datetime

from app.db.engine import get_connection


REQUIRED_FIELDS = {"id", "email", "hashed_password", "is_active", "is_superuser"}


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def main() -> None:
    payload = json.load(sys.stdin)
    missing = REQUIRED_FIELDS - payload.keys()
    if missing:
        raise ValueError(f"Bootstrap payload is missing fields: {', '.join(sorted(missing))}")
    if payload["id"] != 1:
        raise ValueError("Only users.id = 1 may be bootstrapped")
    if not payload["is_active"] or not payload["is_superuser"]:
        raise ValueError("User 1 must already be active and a superuser")

    pool = await get_connection()
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                count = await conn.fetchval("SELECT COUNT(*) FROM users")
                if count != 0:
                    raise RuntimeError("Bootstrap requires an empty users table")

                admin_role_id = await conn.fetchval(
                    """
                    INSERT INTO roles (name, description, level)
                    VALUES ('admin', 'Administrator with full system access', 100)
                    ON CONFLICT (name) DO UPDATE SET level = 100
                    RETURNING id
                    """
                )
                await conn.execute(
                    """
                    INSERT INTO users (
                        id, company_id, email, hashed_password, first_name,
                        last_name, phone, is_active, is_superuser, highest_level,
                        must_change_password, password_set_at, created_at, updated_at
                    ) VALUES (
                        1, NULL, $1, $2, $3, $4, $5, TRUE, TRUE, 100,
                        $6, $7::timestamptz, $8::timestamptz, $9::timestamptz
                    )
                    """,
                    payload["email"],
                    payload["hashed_password"],
                    payload.get("first_name"),
                    payload.get("last_name"),
                    payload.get("phone"),
                    payload.get("must_change_password", False),
                    parse_timestamp(payload.get("password_set_at")),
                    parse_timestamp(payload.get("created_at")),
                    parse_timestamp(payload.get("updated_at")),
                )
                await conn.execute(
                    "INSERT INTO user_roles (user_id, role_id) VALUES (1, $1) ON CONFLICT DO NOTHING",
                    admin_role_id,
                )
                await conn.execute(
                    "SELECT setval(pg_get_serial_sequence('users', 'id'), 1, TRUE)"
                )

                verified = await conn.fetchrow(
                    """
                    SELECT COUNT(*) OVER () AS user_count, u.id, u.is_active,
                           u.is_superuser, u.highest_level, r.name AS role_name
                    FROM users u
                    JOIN user_roles ur ON ur.user_id = u.id
                    JOIN roles r ON r.id = ur.role_id
                    WHERE u.id = 1 AND r.name = 'admin'
                    """
                )
                if not verified or verified["user_count"] != 1:
                    raise RuntimeError("User 1 bootstrap verification failed")
    finally:
        await pool.close()

    print("User 1 bootstrap verified: one active superuser with admin role")


if __name__ == "__main__":
    asyncio.run(main())
