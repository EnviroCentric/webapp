-- name: get_all_roles
SELECT id, name, description, level, created_at
FROM roles
ORDER BY level DESC;

-- name: get_role_by_id
SELECT id, name, description, level, created_at
FROM roles
WHERE id = $1;

-- name: get_role_by_name
SELECT id, name, description, level, created_at
FROM roles
WHERE name = $1;

-- name: get_user_roles
SELECT r.id, r.name, r.description, r.level, r.created_at
FROM roles r
JOIN user_roles ur ON r.id = ur.role_id
WHERE ur.user_id = $1
ORDER BY r.level DESC;

-- name: create_role
INSERT INTO roles (name, description, level)
VALUES ($1, $2, $3)
RETURNING id;

-- name: update_role
UPDATE roles
SET
  name = COALESCE($2, name),
  description = COALESCE($3, description),
  level = COALESCE($4, level)
WHERE id = $1
RETURNING id, name, description, level, created_at;

-- name: delete_role
DELETE FROM roles
WHERE id = $1;

-- name: get_or_create_admin_role
INSERT INTO roles (name, description, level)
VALUES ('admin', 'Administrator with full system access', 100)
ON CONFLICT (name) DO UPDATE SET level = 100
RETURNING id;

-- name: get_assignable_roles
-- Get roles that can be assigned (excludes admin for normal assignment)
SELECT id, name, description, level, created_at
FROM roles
WHERE level < 100
ORDER BY level DESC;

-- name: get_client_roles
-- Get roles suitable for client company users
SELECT id, name, description, level, created_at
FROM roles
WHERE level <= 10
ORDER BY level DESC;
