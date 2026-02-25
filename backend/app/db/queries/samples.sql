-- Sample management queries
-- NOTE: As of migration `0007_restructure_visits_with_addresses.sql`, the `addresses`
-- table and `samples.address_id` are removed. Samples are linked to a project visit.

-- name: create_sample
INSERT INTO samples (
    project_id,
    visit_id,
    collected_by,
    collected_at,
    description,
    is_inside,
    flow_rate,
    volume_required,
    sample_status,
    reject_reason,
    cassette_barcode
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: get_sample
SELECT
    s.*,
    p.name as project_name,
    pv.description as visit_description,
    u.first_name || ' ' || u.last_name as collected_by_name
FROM samples s
LEFT JOIN projects p ON s.project_id = p.id
LEFT JOIN project_visits pv ON s.visit_id = pv.id
LEFT JOIN users u ON s.collected_by = u.id
WHERE s.id = $1;

-- name: get_samples_by_project
SELECT
    s.*,
    pv.description as visit_description,
    u.first_name || ' ' || u.last_name as collected_by_name
FROM samples s
LEFT JOIN project_visits pv ON s.visit_id = pv.id
LEFT JOIN users u ON s.collected_by = u.id
WHERE s.project_id = $1
ORDER BY s.collected_at DESC;

-- name: get_samples_by_visit
SELECT
    s.*,
    pv.description as visit_description,
    u.first_name || ' ' || u.last_name as collected_by_name
FROM samples s
LEFT JOIN project_visits pv ON s.visit_id = pv.id
LEFT JOIN users u ON s.collected_by = u.id
WHERE s.visit_id = $1
ORDER BY s.collected_at DESC;

-- name: update_sample
UPDATE samples
SET
    description = COALESCE($2, description),
    is_inside = COALESCE($3, is_inside),
    flow_rate = COALESCE($4, flow_rate),
    volume_required = COALESCE($5, volume_required),
    sample_status = COALESCE($6, sample_status),
    reject_reason = COALESCE($7, reject_reason),
    cassette_barcode = COALESCE($8, cassette_barcode),
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: delete_sample
DELETE FROM samples WHERE id = $1;

-- name: list_samples
SELECT
    s.*,
    p.name as project_name,
    pv.description as visit_description,
    u.first_name || ' ' || u.last_name as collected_by_name
FROM samples s
LEFT JOIN projects p ON s.project_id = p.id
LEFT JOIN project_visits pv ON s.visit_id = pv.id
LEFT JOIN users u ON s.collected_by = u.id
ORDER BY s.collected_at DESC;

-- name: get_samples_by_status
SELECT
    s.*,
    p.name as project_name,
    pv.description as visit_description,
    u.first_name || ' ' || u.last_name as collected_by_name
FROM samples s
LEFT JOIN projects p ON s.project_id = p.id
LEFT JOIN project_visits pv ON s.visit_id = pv.id
LEFT JOIN users u ON s.collected_by = u.id
WHERE s.sample_status = $1
ORDER BY s.collected_at DESC;

-- name: update_sample_status
UPDATE samples
SET
    sample_status = $2,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;
