-- name: create_sample
INSERT INTO samples (address_id, description, cassette_barcode, flow_rate, volume_required) VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: get_sample
SELECT * FROM samples WHERE id = $1;

-- name: get_samples_by_address
SELECT * FROM samples WHERE address_id = $1 ORDER BY created_at DESC;

-- name: get_samples_by_address_and_date
SELECT * FROM samples WHERE address_id = $1 AND DATE(created_at) = $2 ORDER BY created_at DESC;

-- name: update_sample
UPDATE samples
SET 
    description = COALESCE($2, description),
    is_inside = COALESCE($3, is_inside),
    flow_rate = COALESCE($4, flow_rate),
    volume_required = COALESCE($5, volume_required),
    start_time = COALESCE($6, start_time),
    stop_time = COALESCE($7, stop_time),
    fields = COALESCE($8, fields),
    fibers = COALESCE($9, fibers),
    cassette_barcode = COALESCE($10, cassette_barcode)
WHERE id = $1
RETURNING *;

-- name: delete_sample
DELETE FROM samples WHERE id = $1;

-- name: list_samples
SELECT * FROM samples ORDER BY created_at DESC; 