-- Migration: Add report upload metadata fields to reports table
-- Date: 2026-02-24
-- Description:
--   Adds fields to support three report kinds (personal/clearance/area),
--   a report date, a Google Places-backed address, an optional sub-location
--   label ("location"), and an optional worker name for personal reports.

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS report_kind VARCHAR(20),
ADD COLUMN IF NOT EXISTS report_date DATE,
ADD COLUMN IF NOT EXISTS formatted_address TEXT,
ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_label TEXT,
ADD COLUMN IF NOT EXISTS worker_name TEXT;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_reports_google_place_id ON reports(google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_report_date ON reports(report_date) WHERE report_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_report_kind ON reports(report_kind) WHERE report_kind IS NOT NULL;
