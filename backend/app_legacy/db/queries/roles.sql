-- name: get_all_roles
SELECT 
    id,
    name,
    description,
    level,
    created_at
FROM roles
ORDER BY level DESC;

-- name: get_role_by_id
SELECT 
    id,
    name,
    description,
    level,
    created_at
FROM roles
WHERE id = $1;

-- name: get_role_by_name
SELECT 
    id,
    name,
    description,
    level,
    created_at
FROM roles
WHERE name = $1;

-- name: get_user_roles
SELECT 
    r.id,
    r.name,
    r.description,
    r.level,
    r.created_at
FROM roles r
JOIN user_roles ur ON r.id = ur.role_id
WHERE ur.user_id = $1
ORDER BY r.level DESC;

-- name: get_user_roles_with_permissions
SELECT 
    r.id,
    r.name,
    r.description,
    r.level,
    r.created_at,
    COALESCE(array_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL), '{}') AS permissions
FROM roles r
JOIN user_roles ur ON r.id = ur.role_id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE ur.user_id = $1
GROUP BY r.id, r.name, r.description, r.level, r.created_at
ORDER BY r.level DESC;

-- name: create_role
INSERT INTO roles (
    name,
    description,
    level
) VALUES (
    $1, $2, $3
) RETURNING id;

-- name: update_role
UPDATE roles
SET 
    name = COALESCE($2, name),
    description = COALESCE($3, description),
    level = COALESCE($4, level),
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: delete_role
DELETE FROM roles
WHERE id = $1;

-- name: get_or_create_admin_role
INSERT INTO roles (name, description, level)
VALUES ('admin', 'Administrator with full system access', 100)
ON CONFLICT (name) DO UPDATE SET level = 100
RETURNING id; 