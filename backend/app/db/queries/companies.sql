-- Company management queries for multi-tenant client system

-- name: create_company
INSERT INTO companies (name, address_line1, address_line2, city, state, zip)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: get_company
SELECT
    c.*,
    pc.first_name || ' ' || pc.last_name AS primary_contact_name,
    pc.email AS primary_contact_email,
    pc.phone AS primary_contact_phone
FROM companies c
LEFT JOIN users pc ON pc.id = c.primary_contact_user_id
WHERE c.id = $1;

-- name: get_company_by_name
SELECT
    c.*,
    pc.first_name || ' ' || pc.last_name AS primary_contact_name,
    pc.email AS primary_contact_email,
    pc.phone AS primary_contact_phone
FROM companies c
LEFT JOIN users pc ON pc.id = c.primary_contact_user_id
WHERE c.name = $1;

-- name: update_company
UPDATE companies
SET
    name = COALESCE($2, name),
    address_line1 = COALESCE($3, address_line1),
    address_line2 = COALESCE($4, address_line2),
    city = COALESCE($5, city),
    state = COALESCE($6, state),
    zip = COALESCE($7, zip),
    primary_contact_user_id = COALESCE($8, primary_contact_user_id)
WHERE id = $1
RETURNING *;

-- name: delete_company
DELETE FROM companies WHERE id = $1;

-- name: list_companies
-- Staff list view: include project/client counts and primary contact metadata.
SELECT
    c.*,
    pc.first_name || ' ' || pc.last_name AS primary_contact_name,
    pc.email AS primary_contact_email,
    pc.phone AS primary_contact_phone,
    COALESCE(proj.total_projects, 0) AS total_projects,
    COALESCE(proj.open_projects, 0) AS open_projects,
    COALESCE(cli.client_count, 0) AS client_count
FROM companies c
LEFT JOIN users pc ON pc.id = c.primary_contact_user_id
LEFT JOIN (
    SELECT
        p.company_id,
        COUNT(*) AS total_projects,
        COUNT(*) FILTER (WHERE p.status = 'open') AS open_projects
    FROM projects p
    GROUP BY p.company_id
) proj ON proj.company_id = c.id
LEFT JOIN (
    SELECT
        u.company_id,
        COUNT(DISTINCT u.id) AS client_count
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.name = 'client'
    GROUP BY u.company_id
) cli ON cli.company_id = c.id
ORDER BY c.name ASC;

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

-- name: get_company_clients
-- Company users filtered to only the Client role.
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
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.company_id = $1
  AND r.name = 'client'
ORDER BY u.created_at ASC;

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