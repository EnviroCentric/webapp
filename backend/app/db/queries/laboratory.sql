-- Laboratory workflow queries for environmental sampling

-- Sample management (enhanced version)
-- name: create_sample
INSERT INTO samples (
    project_id, visit_id, sample_id, sample_type, matrix,
    collection_date, collection_time, collector_name, 
    location_description, depth, coordinates, weather_conditions,
    temperature, ph, notes, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
) RETURNING *;

-- name: get_sample
SELECT 
    s.*,
    p.name as project_name,
    c.name as company_name,
    sb.batch_number,
    sb.id as batch_id
FROM samples s
LEFT JOIN projects p ON s.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN sample_batches sb ON s.batch_id = sb.id
WHERE s.id = $1;

-- name: update_sample
UPDATE samples
SET 
    sample_type = COALESCE($2, sample_type),
    matrix = COALESCE($3, matrix),
    collection_date = COALESCE($4, collection_date),
    collection_time = COALESCE($5, collection_time),
    collector_name = COALESCE($6, collector_name),
    location_description = COALESCE($7, location_description),
    depth = COALESCE($8, depth),
    coordinates = COALESCE($9, coordinates),
    weather_conditions = COALESCE($10, weather_conditions),
    temperature = COALESCE($11, temperature),
    ph = COALESCE($12, ph),
    notes = COALESCE($13, notes),
    status = COALESCE($14, status),
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: list_samples
SELECT 
    s.*,
    p.name as project_name,
    c.name as company_name,
    sb.batch_number,
    sb.id as batch_id
FROM samples s
LEFT JOIN projects p ON s.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN sample_batches sb ON s.batch_id = sb.id
ORDER BY s.created_at DESC;

-- name: get_samples_by_status
SELECT 
    s.*,
    p.name as project_name,
    c.name as company_name,
    sb.batch_number
FROM samples s
LEFT JOIN projects p ON s.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN sample_batches sb ON s.batch_id = sb.id
WHERE s.status = $1
ORDER BY s.created_at DESC;

-- name: get_unassigned_samples
SELECT 
    s.*,
    p.name as project_name,
    c.name as company_name
FROM samples s
LEFT JOIN projects p ON s.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
WHERE s.batch_id IS NULL
ORDER BY s.created_at DESC;

-- Sample Batch management
-- name: create_sample_batch
INSERT INTO sample_batches (
    batch_number, description, analyst_id, lab_workflow_id,
    expected_completion_date, notes, status
) VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: get_sample_batch
SELECT 
    sb.*,
    u.first_name || ' ' || u.last_name as analyst_name,
    lw.name as workflow_name,
    COUNT(s.id) as sample_count
FROM sample_batches sb
LEFT JOIN users u ON sb.analyst_id = u.id
LEFT JOIN lab_workflows lw ON sb.lab_workflow_id = lw.id
LEFT JOIN samples s ON sb.id = s.batch_id
WHERE sb.id = $1
GROUP BY sb.id, u.first_name, u.last_name, lw.name;

-- name: update_sample_batch
UPDATE sample_batches
SET 
    description = COALESCE($2, description),
    analyst_id = COALESCE($3, analyst_id),
    expected_completion_date = COALESCE($4, expected_completion_date),
    notes = COALESCE($5, notes),
    status = COALESCE($6, status),
    actual_completion_date = COALESCE($7, actual_completion_date),
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: list_sample_batches
SELECT 
    sb.*,
    u.first_name || ' ' || u.last_name as analyst_name
FROM sample_batches sb
LEFT JOIN users u ON sb.analyst_id = u.id
ORDER BY sb.created_at DESC;

-- name: get_batch_samples
SELECT 
    s.*,
    p.name as project_name,
    c.name as company_name
FROM samples s
JOIN projects p ON s.project_id = p.id
LEFT JOIN companies c ON p.company_id = c.id
WHERE s.batch_id = $1
ORDER BY s.sample_id;

-- name: assign_samples_to_batch
UPDATE samples
SET batch_id = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = ANY($2::int[])
RETURNING *;

-- name: remove_samples_from_batch
UPDATE samples
SET batch_id = NULL, updated_at = CURRENT_TIMESTAMP
WHERE batch_id = $1 AND id = ANY($2::int[])
RETURNING *;

-- Analysis Run management
-- name: create_analysis_run
INSERT INTO analysis_runs (
    sample_id, batch_sample_id, run_number, analyzed_by
) VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: get_analysis_run
SELECT 
    ar.*,
    u.first_name || ' ' || u.last_name as analyst_name
FROM analysis_runs ar
LEFT JOIN users u ON ar.analyzed_by = u.id
WHERE ar.id = $1;

-- name: update_analysis_run
UPDATE analysis_runs
SET 
    analyzed_by = COALESCE($2, analyzed_by),
    total_fields = COALESCE($3, total_fields),
    total_fibers = COALESCE($4, total_fibers),
    is_overload = COALESCE($5, is_overload),
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: list_analysis_runs
SELECT 
    ar.*,
    u.first_name || ' ' || u.last_name as analyst_name
FROM analysis_runs ar
LEFT JOIN users u ON ar.analyzed_by = u.id
ORDER BY ar.created_at DESC;

-- name: get_runs_by_batch
SELECT 
    ar.*,
    u.first_name || ' ' || u.last_name as analyst_name
FROM analysis_runs ar
JOIN batch_samples bs ON ar.batch_sample_id = bs.id
LEFT JOIN users u ON ar.analyzed_by = u.id
WHERE bs.batch_id = $1
ORDER BY ar.run_number;

-- Analysis runs are tracked directly in the analysis_runs table
-- which is linked to batch_samples (and thus to sample_batches)
ORDER BY name;

-- name: list_all_methods
SELECT * FROM methods 
ORDER BY name;

-- Dashboard queries
-- name: get_lab_dashboard_stats
SELECT 
    (SELECT COUNT(*) FROM samples WHERE status = 'collected') as pending_samples,
    (SELECT COUNT(*) FROM samples WHERE status = 'in_analysis') as in_analysis_samples,
    (SELECT COUNT(*) FROM samples WHERE status = 'completed') as completed_samples,
    (SELECT COUNT(*) FROM sample_batches WHERE status = 'open') as open_batches,
    (SELECT COUNT(*) FROM qa_reviews WHERE qa_status = 'pending') as pending_qa_reviews,
    (SELECT COUNT(*) FROM sample_batches 
     WHERE status != 'completed' AND expected_completion_date < CURRENT_DATE) as overdue_batches;

-- name: get_recent_completions
SELECT 
    'batch' as item_type,
    sb.id as item_id,
    sb.batch_number as item_name,
    sb.actual_completion_date as completion_date,
    u.first_name || ' ' || u.last_name as completed_by
FROM sample_batches sb
LEFT JOIN users u ON sb.analyst_id = u.id
WHERE sb.status = 'completed' 
    AND sb.actual_completion_date >= CURRENT_DATE - INTERVAL '7 days'
UNION ALL
SELECT 
    'run' as item_type,
    ar.id as item_id,
    ar.run_number as item_name,
    ar.completion_date as completion_date,
    u.first_name || ' ' || u.last_name as completed_by
FROM analysis_runs ar
LEFT JOIN users u ON ar.analyst_id = u.id
WHERE ar.status = 'completed' 
    AND ar.completion_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY completion_date DESC
LIMIT 10;
