-- Report management queries for completed analysis results

-- NOTE: As of migration `0007_restructure_visits_with_addresses.sql`, the `addresses`
-- table and `reports.address_id` are removed. Reports are project-scoped.

-- name: create_report
INSERT INTO reports (
    project_id,
    report_name,
    report_file_path,
    generated_by,
    report_data,
    is_final,
    client_visible,
    notes
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: create_uploaded_report
-- Create a PDF-uploaded report with required metadata.
INSERT INTO reports (
    project_id,
    report_name,
    report_kind,
    report_date,
    formatted_address,
    google_place_id,
    latitude,
    longitude,
    location_label,
    worker_name,
    report_file_path,
    generated_by,
    report_data,
    is_final,
    client_visible,
    notes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
)
RETURNING *;

-- name: get_report
SELECT 
    r.*,
    p.name as project_name,
    c.name as company_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
LEFT JOIN projects p ON r.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
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
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
LEFT JOIN users u ON r.generated_by = u.id
WHERE r.project_id = $1
ORDER BY r.generated_at DESC;

-- name: get_company_reports
-- Get all reports for a company's projects.
SELECT 
    r.*,
    p.name as project_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
JOIN projects p ON r.project_id = p.id
LEFT JOIN users u ON r.generated_by = u.id
WHERE p.company_id = $1
ORDER BY COALESCE(r.report_date, r.generated_at::date) DESC, r.generated_at DESC;

-- name: list_report_locations_for_place
-- Distinct location labels previously used for a given google_place_id within a company.
SELECT DISTINCT r.location_label
FROM reports r
JOIN projects p ON r.project_id = p.id
WHERE p.company_id = $1
  AND r.google_place_id = $2
  AND r.location_label IS NOT NULL
  AND r.location_label <> ''
ORDER BY r.location_label ASC;

-- name: get_address_reports_deprecated
-- Deprecated: address-scoped reports are no longer supported after visit/address normalization.
-- Keeping the query name reserved to prevent accidental reintroduction.
SELECT 1 WHERE FALSE;

-- name: list_all_reports
SELECT 
    r.*,
    p.name as project_name,
    c.name as company_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
LEFT JOIN projects p ON r.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN users u ON r.generated_by = u.id
ORDER BY r.generated_at DESC;

-- name: get_pending_reports
-- Get reports that are not yet final
SELECT 
    r.*,
    p.name as project_name,
    c.name as company_name,
    u.first_name || ' ' || u.last_name as generated_by_name
FROM reports r
LEFT JOIN projects p ON r.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN users u ON r.generated_by = u.id
WHERE r.is_final = FALSE
ORDER BY r.generated_at ASC;

-- name: check_report_exists_deprecated
-- Deprecated: address-scoped check no longer applies.
SELECT FALSE as report_exists;
