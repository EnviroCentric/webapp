-- name: get_user_by_email
SELECT
  id,
  company_id,
  email,
  hashed_password,
  first_name,
  last_name,
  phone,
  is_active,
  is_superuser,
  highest_level,
  must_change_password,
  password_set_at,
  created_at,
  updated_at
FROM users
WHERE LOWER(email) = LOWER($1);

-- name: get_user_highest_role_level
SELECT COALESCE(MAX(r.level), 0) AS highest_level
FROM roles r
JOIN user_roles ur ON r.id = ur.role_id
WHERE ur.user_id = $1;

-- name: get_all_users
SELECT
  u.id,
  u.company_id,
  c.name as company_name,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.is_active,
  u.is_superuser,
  u.highest_level,
  u.must_change_password,
  u.password_set_at,
  u.created_at,
  u.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', r.id,
        'name', r.name,
        'description', r.description,
        'level', r.level,
        'created_at', r.created_at
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  )::jsonb AS roles
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
GROUP BY u.id, c.name
ORDER BY u.created_at DESC;

-- name: get_user_by_id
SELECT
  u.id,
  u.company_id,
  c.name as company_name,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.is_active,
  u.is_superuser,
  u.highest_level,
  u.must_change_password,
  u.password_set_at,
  u.created_at,
  u.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', r.id,
        'name', r.name,
        'description', r.description,
        'level', r.level,
        'created_at', r.created_at
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  )::jsonb AS roles
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.id = $1
GROUP BY u.id, c.name;

-- name: create_user
INSERT INTO users (
  company_id,
  email,
  hashed_password,
  first_name,
  last_name,
  phone,
  is_active,
  is_superuser
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id;

-- name: create_user_with_must_change_password
INSERT INTO users (
  company_id,
  email,
  hashed_password,
  first_name,
  last_name,
  phone,
  is_active,
  is_superuser,
  must_change_password
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id;

-- name: update_user
UPDATE users
SET
  company_id = COALESCE($2, company_id),
  email = COALESCE($3, email),
  hashed_password = COALESCE($4, hashed_password),
  first_name = COALESCE($5, first_name),
  last_name = COALESCE($6, last_name),
  phone = COALESCE($7, phone),
  is_active = COALESCE($8, is_active),
  is_superuser = COALESCE($9, is_superuser),
  updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING
  id,
  company_id,
  email,
  first_name,
  last_name,
  phone,
  is_active,
  is_superuser,
  highest_level,
  must_change_password,
  password_set_at,
  created_at,
  updated_at;

-- name: delete_user
DELETE FROM users
WHERE id = $1
RETURNING id;

-- name: delete_user_roles
DELETE FROM user_roles WHERE user_id = $1;

-- name: insert_user_role
INSERT INTO user_roles (user_id, role_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: recalc_user_highest_role_level
WITH maxlvl AS (
  SELECT COALESCE(MAX(r.level), 0) AS lvl
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = $1
)
UPDATE users
SET highest_level = (SELECT lvl FROM maxlvl)
WHERE id = $1;

-- name: get_user_by_id_with_password
SELECT
  id,
  company_id,
  email,
  hashed_password,
  first_name,
  last_name,
  phone,
  is_active,
  is_superuser,
  highest_level,
  must_change_password,
  password_set_at,
  created_at,
  updated_at
FROM users
WHERE id = $1;

-- name: update_user_password
UPDATE users
SET
  hashed_password = $2,
  must_change_password = FALSE,
  password_set_at = CURRENT_TIMESTAMP,
  updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: get_users_by_min_role_level
SELECT
  u.id,
  u.company_id,
  c.name as company_name,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.is_active,
  u.is_superuser,
  u.highest_level,
  u.must_change_password,
  u.password_set_at,
  u.created_at,
  u.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', r.id,
        'name', r.name,
        'description', r.description,
        'level', r.level,
        'created_at', r.created_at
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  )::jsonb AS roles
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.is_active = true
  AND u.highest_level >= $1
GROUP BY u.id, c.name
ORDER BY u.first_name, u.last_name;

-- name: get_employees_minimal
SELECT
  u.id,
  u.first_name,
  u.last_name,
  COALESCE(
    json_agg(
      json_build_object(
        'id', r.id,
        'name', r.name,
        'description', r.description,
        'level', r.level,
        'created_at', r.created_at
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  )::jsonb AS roles
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.is_active = true
  AND (
    u.is_superuser = true 
    OR EXISTS (
      SELECT 1 FROM user_roles ur2 
      JOIN roles r2 ON ur2.role_id = r2.id 
      WHERE ur2.user_id = u.id 
      AND r2.level >= $1
    )
  )
GROUP BY u.id
ORDER BY u.first_name, u.last_name;
