-- Project queries
-- name: create_project
INSERT INTO projects (name) VALUES ($1) RETURNING *;

-- name: get_project
SELECT * FROM projects WHERE id = $1;

-- name: update_project
UPDATE projects SET name = $2 WHERE id = $1 RETURNING *;

-- name: delete_project
DELETE FROM projects WHERE id = $1;

-- name: list_projects
SELECT * FROM projects ORDER BY created_at DESC;

-- name: list_technician_projects
SELECT p.* 
FROM projects p
JOIN project_technicians pt ON p.id = pt.project_id
WHERE pt.user_id = $1
ORDER BY p.created_at DESC;

-- Address queries
-- name: create_address
INSERT INTO addresses (name, date) VALUES ($1, $2) RETURNING *;

-- name: get_address
SELECT * FROM addresses WHERE id = $1;

-- name: update_address
UPDATE addresses SET name = $2, date = $3 WHERE id = $1 RETURNING *;

-- name: delete_address
DELETE FROM addresses WHERE id = $1;

-- name: add_address_to_project
UPDATE projects 
SET address_ids = array_append(address_ids, $2)
WHERE id = $1
RETURNING *;

-- name: remove_address_from_project
UPDATE projects 
SET address_ids = array_remove(address_ids, $2)
WHERE id = $1
RETURNING *;

-- name: get_project_addresses
SELECT a.* 
FROM addresses a
WHERE a.id = ANY(
    SELECT unnest(address_ids)
    FROM projects
    WHERE id = $1
)
ORDER BY a.date DESC;

-- name: get_project_addresses_by_date
SELECT a.*
FROM addresses a
WHERE a.id = ANY(
    SELECT unnest(address_ids)
    FROM projects
    WHERE id = $1
)
AND a.date = $2
ORDER BY a.date DESC;

-- Project Technician queries
-- name: assign_technician
INSERT INTO project_technicians (project_id, user_id)
VALUES ($1, $2)
ON CONFLICT (project_id, user_id) DO NOTHING
RETURNING *;

-- name: remove_technician
DELETE FROM project_technicians 
WHERE project_id = $1 AND user_id = $2;

-- name: get_project_technicians
SELECT u.* 
FROM users u
JOIN project_technicians pt ON u.id = pt.user_id
WHERE pt.project_id = $1;

-- name: check_technician_assigned
SELECT EXISTS(
    SELECT 1 
    FROM project_technicians 
    WHERE project_id = $1 AND user_id = $2
) as is_assigned;

-- name: check_address_in_project
SELECT EXISTS(
    SELECT 1
    FROM projects
    WHERE id = $1 AND $2 = ANY(address_ids)
) as is_project_address; 