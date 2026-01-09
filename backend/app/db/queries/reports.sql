-- Report management queries for completed analysis results

-- name: create_report
INSERT INTO reports (
    project_id,
    address_id,
    report_name,
    report_file_path,
    generated_by,
    report_data,
    is_final,
    client_visible,
    notes
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: get_report
SELECT 
    r.*,
    p.name as project_name,
    c.name as company_name,
    a.name as address_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
LEFT JOIN projects p ON r.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN addresses a ON r.address_id = a.id
LEFT JOIN users u ON r.generated_by = u.id
WHERE r.id = $1;

-- name: update_report
UPDATE reports
SET
    report_name = COALESCE($2, report_name),
    report_file_path = COALESCE($3, report_file_path),
    report_data = COALESCE($4, report_data),
    is_final = COALESCE($5, is_final),
    client_visible = COALESCE($6, client_visible),
    notes = COALESCE($7, notes)
WHERE id = $1
RETURNING *;

-- name: finalize_report
UPDATE reports
SET
    is_final = TRUE,
    client_visible = TRUE
WHERE id = $1
RETURNING *;

-- name: delete_report
DELETE FROM reports WHERE id = $1;

-- name: get_project_reports
SELECT 
    r.*,
    a.name as address_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
LEFT JOIN addresses a ON r.address_id = a.id
LEFT JOIN users u ON r.generated_by = u.id
WHERE r.project_id = $1
ORDER BY r.generated_at DESC;

-- name: get_company_reports
-- Get all reports for a company's projects (for client access)
SELECT 
    r.*,
    p.name as project_name,
    a.name as address_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
JOIN projects p ON r.project_id = p.id
LEFT JOIN addresses a ON r.address_id = a.id
LEFT JOIN users u ON r.generated_by = u.id
WHERE p.company_id = $1 AND r.client_visible = TRUE
ORDER BY r.generated_at DESC;

-- name: get_address_reports
SELECT 
    r.*,
    p.name as project_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
LEFT JOIN projects p ON r.project_id = p.id
LEFT JOIN users u ON r.generated_by = u.id
WHERE r.address_id = $1
ORDER BY r.generated_at DESC;

-- name: list_all_reports
SELECT 
    r.*,
    p.name as project_name,
    c.name as company_name,
    a.name as address_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
LEFT JOIN projects p ON r.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN addresses a ON r.address_id = a.id
LEFT JOIN users u ON r.generated_by = u.id
ORDER BY r.generated_at DESC;

-- name: get_pending_reports
-- Get reports that are not yet final
SELECT 
    r.*,
    p.name as project_name,
    c.name as company_name,
    a.name as address_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
LEFT JOIN projects p ON r.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN addresses a ON r.address_id = a.id
LEFT JOIN users u ON r.generated_by = u.id
WHERE r.is_final = FALSE
ORDER BY r.generated_at ASC;

-- name: check_report_exists
SELECT EXISTS(
    SELECT 1 FROM reports 
    WHERE project_id = $1 AND address_id = $2
) as report_exists;