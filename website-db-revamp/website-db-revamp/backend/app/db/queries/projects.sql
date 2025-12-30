-- Project queries
-- name: create_project
INSERT INTO projects (company_id, name, description, status, current_start_date, current_end_date)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: get_project
SELECT 
    p.*,
    c.name as company_name
FROM projects p
LEFT JOIN companies c ON p.company_id = c.id
WHERE p.id = $1;

-- name: update_project
UPDATE projects 
SET 
    name = COALESCE($2, name),
    description = COALESCE($3, description),
    status = COALESCE($4, status),
    current_start_date = COALESCE($5, current_start_date),
    current_end_date = COALESCE($6, current_end_date),
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1 
RETURNING *;

-- name: delete_project
DELETE FROM projects WHERE id = $1;

-- name: list_projects
SELECT 
    p.*,
    c.name as company_name
FROM projects p
LEFT JOIN companies c ON p.company_id = c.id
ORDER BY p.created_at DESC;

-- name: list_projects_by_company
SELECT 
    p.*,
    c.name as company_name
FROM projects p
LEFT JOIN companies c ON p.company_id = c.id
WHERE p.company_id = $1
ORDER BY p.created_at DESC;

-- name: list_technician_projects
SELECT DISTINCT p.*, c.name as company_name
FROM projects p
LEFT JOIN companies c ON p.company_id = c.id
JOIN project_visits pv ON p.id = pv.project_id
WHERE pv.technician_id = $1
ORDER BY p.created_at DESC;

-- Address functionality is now handled through project visits
-- No separate address queries needed

-- name: get_project_visits
-- Returns all project visits with embedded address data
SELECT 
    pv.*,
    u.first_name || ' ' || u.last_name as technician_name
FROM project_visits pv
LEFT JOIN users u ON pv.technician_id = u.id
WHERE pv.project_id = $1
ORDER BY pv.visit_date DESC, pv.created_at DESC;

-- name: get_project_visits_by_date
-- Returns project visits for a specific date
SELECT 
    pv.*,
    u.first_name || ' ' || u.last_name as technician_name
FROM project_visits pv
LEFT JOIN users u ON pv.technician_id = u.id
WHERE pv.project_id = $1 AND pv.visit_date = $2
ORDER BY pv.visit_date DESC, pv.created_at DESC;

-- Project Visit queries (now includes embedded address data)
-- name: create_project_visit
INSERT INTO project_visits (
    project_id, visit_date, technician_id, notes, description,
    address_line1, address_line2, city, state, zip,
    formatted_address, google_place_id, latitude, longitude, place_types,
    country, postal_code, administrative_area_level_1, administrative_area_level_2,
    locality, sublocality, route, street_number, plus_code
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19,
    $20, $21, $22, $23, $24
)
RETURNING *;

-- name: update_project_visit
UPDATE project_visits 
SET 
    visit_date = COALESCE($2, visit_date),
    technician_id = COALESCE($3, technician_id),
    notes = COALESCE($4, notes),
    description = COALESCE($5, description),
    address_line1 = COALESCE($6, address_line1),
    address_line2 = COALESCE($7, address_line2),
    city = COALESCE($8, city),
    state = COALESCE($9, state),
    zip = COALESCE($10, zip),
    formatted_address = COALESCE($11, formatted_address),
    google_place_id = COALESCE($12, google_place_id),
    latitude = COALESCE($13, latitude),
    longitude = COALESCE($14, longitude),
    place_types = COALESCE($15, place_types),
    country = COALESCE($16, country),
    postal_code = COALESCE($17, postal_code),
    administrative_area_level_1 = COALESCE($18, administrative_area_level_1),
    administrative_area_level_2 = COALESCE($19, administrative_area_level_2),
    locality = COALESCE($20, locality),
    sublocality = COALESCE($21, sublocality),
    route = COALESCE($22, route),
    street_number = COALESCE($23, street_number),
    plus_code = COALESCE($24, plus_code)
WHERE id = $1
RETURNING *;

-- name: delete_project_visit
DELETE FROM project_visits WHERE id = $1;

-- name: get_project_technicians
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.highest_level,
    pt.assigned_at,
    COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', r.id,
                'name', r.name,
                'level', r.level
            )
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
    ) as roles
FROM users u
JOIN project_technicians pt ON u.id = pt.technician_id
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE pt.project_id = $1
GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.highest_level, pt.assigned_at
ORDER BY pt.assigned_at DESC;

-- name: check_technician_assigned_to_project
SELECT EXISTS(
    SELECT 1 
    FROM project_technicians 
    WHERE project_id = $1 AND technician_id = $2
) as is_assigned;

-- Address checking is no longer needed since addresses are embedded in visits

-- Project technician assignment queries (separate from visits)
-- name: assign_technician_to_project
INSERT INTO project_technicians (project_id, technician_id, assigned_by)
VALUES ($1, $2, $3)
ON CONFLICT (project_id, technician_id) DO NOTHING
RETURNING *;

-- name: unassign_technician_from_project
DELETE FROM project_technicians 
WHERE project_id = $1 AND technician_id = $2
RETURNING *;

-- name: list_technician_assigned_projects
SELECT DISTINCT p.*, c.name as company_name
FROM projects p
LEFT JOIN companies c ON p.company_id = c.id
JOIN project_technicians pt ON p.id = pt.project_id
WHERE pt.technician_id = $1
ORDER BY p.created_at DESC;

-- name: get_project_addresses
-- Get unique address data for a project from visits
SELECT DISTINCT
    COALESCE(pv.address_line1, '') as address_line1,
    pv.address_line2,
    COALESCE(pv.city, pv.locality, '') as city,
    COALESCE(pv.state, pv.administrative_area_level_1, '') as state,
    COALESCE(pv.zip, pv.postal_code, '') as zip,
    pv.formatted_address,
    pv.google_place_id,
    pv.latitude,
    pv.longitude,
    pv.place_types,
    pv.country,
    pv.postal_code,
    pv.administrative_area_level_1,
    pv.administrative_area_level_2,
    pv.locality,
    pv.sublocality,
    pv.route,
    pv.street_number,
    pv.plus_code,
    COUNT(pv.id) as visit_count,
    MAX(pv.visit_date) as last_visit_date
FROM project_visits pv
WHERE pv.project_id = $1
  AND (pv.address_line1 IS NOT NULL OR pv.formatted_address IS NOT NULL)
GROUP BY 
    pv.address_line1, pv.address_line2, pv.city, pv.state, pv.zip,
    pv.formatted_address, pv.google_place_id, pv.latitude, pv.longitude,
    pv.place_types, pv.country, pv.postal_code, pv.administrative_area_level_1,
    pv.administrative_area_level_2, pv.locality, pv.sublocality,
    pv.route, pv.street_number, pv.plus_code
ORDER BY last_visit_date DESC;
