-- Company management queries for multi-tenant client system

-- name: create_company
INSERT INTO companies (name, address_line1, address_line2, city, state, zip)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: get_company
SELECT * FROM companies WHERE id = $1;

-- name: get_company_by_name
SELECT * FROM companies WHERE name = $1;

-- name: update_company
UPDATE companies
SET
    name = COALESCE($2, name),
    address_line1 = COALESCE($3, address_line1),
    address_line2 = COALESCE($4, address_line2),
    city = COALESCE($5, city),
    state = COALESCE($6, state),
    zip = COALESCE($7, zip)
WHERE id = $1
RETURNING *;

-- name: delete_company
DELETE FROM companies WHERE id = $1;

-- name: list_companies
SELECT * FROM companies ORDER BY name ASC;

-- name: get_company_users
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    u.is_active,
    u.highest_level,
    u.created_at
FROM users u
WHERE u.company_id = $1
ORDER BY u.created_at DESC;

-- name: get_company_projects
SELECT 
    p.*,
    COUNT(pv.id) as visit_count,
    COUNT(s.id) as sample_count
FROM projects p
LEFT JOIN project_visits pv ON p.id = pv.project_id
LEFT JOIN samples s ON p.id = s.project_id
WHERE p.company_id = $1
GROUP BY p.id
ORDER BY p.created_at DESC;