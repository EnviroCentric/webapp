-- Create view for user roles with permissions
CREATE OR REPLACE VIEW user_roles_with_permissions AS
SELECT 
    ur.user_id,
    r.id,
    r.name,
    r.description,
    r.level,
    r.created_at,
    COALESCE(array_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL), '{}') AS permissions
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY ur.user_id, r.id, r.name, r.description, r.level, r.created_at;

-- name: get_user_by_email
SELECT id, email, hashed_password, first_name, last_name, is_active, is_superuser
FROM users
WHERE email = $1;

-- name: get_user_highest_role_level
SELECT COALESCE(MAX(r.level), 0) as highest_level
FROM roles r 
JOIN user_roles ur ON r.id = ur.role_id 
WHERE ur.user_id = $1;

-- name: get_all_users
SELECT 
    u.id,
    u.email,
    u.hashed_password,
    u.first_name,
    u.last_name,
    u.is_active,
    u.is_superuser,
    u.created_at,
    u.updated_at,
    COALESCE(
        json_agg(
            json_build_object(
                'id', urwp.id,
                'name', urwp.name,
                'description', urwp.description,
                'level', urwp.level,
                'created_at', urwp.created_at,
                'permissions', urwp.permissions
            )
        ) FILTER (WHERE urwp.id IS NOT NULL),
        '[]'::json
    )::jsonb as roles
FROM users u
LEFT JOIN user_roles_with_permissions urwp ON u.id = urwp.user_id
GROUP BY u.id, u.email, u.hashed_password, u.first_name, u.last_name, u.is_active, u.is_superuser, u.created_at, u.updated_at
ORDER BY u.created_at DESC;

-- name: get_user_by_id
SELECT 
    u.id,
    u.email,
    u.hashed_password,
    u.first_name,
    u.last_name,
    u.is_active,
    u.is_superuser,
    u.created_at,
    u.updated_at,
    COALESCE(
        json_agg(
            json_build_object(
                'id', urwp.id,
                'name', urwp.name,
                'description', urwp.description,
                'level', urwp.level,
                'created_at', urwp.created_at,
                'permissions', urwp.permissions
            )
        ) FILTER (WHERE urwp.id IS NOT NULL),
        '[]'::json
    )::jsonb as roles
FROM users u
LEFT JOIN user_roles_with_permissions urwp ON u.id = urwp.user_id
WHERE u.id = $1
GROUP BY u.id, u.email, u.hashed_password, u.first_name, u.last_name, u.is_active, u.is_superuser, u.created_at, u.updated_at;

-- name: create_user
INSERT INTO users (
    email,
    hashed_password,
    first_name,
    last_name,
    is_active,
    is_superuser
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING id;

-- name: update_user
UPDATE users
SET 
    email = COALESCE($2, email),
    hashed_password = COALESCE($3, hashed_password),
    first_name = COALESCE($4, first_name),
    last_name = COALESCE($5, last_name),
    is_active = COALESCE($6, is_active),
    is_superuser = COALESCE($7, is_superuser),
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: delete_user
DELETE FROM users
WHERE id = $1
RETURNING *;

-- name: delete_user_roles
DELETE FROM user_roles WHERE user_id = $1;

-- name: insert_user_role
INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING; 