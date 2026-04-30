-- Migration: Add company primary contact + report technician fields
-- Date: 2026-03-02
-- Description:
--   * Adds companies.primary_contact_user_id to track lead client contact.
--   * Adds reports.technician_user_id + reports.technician_name for uploaded report attribution.

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS primary_contact_user_id INT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_companies_primary_contact_user_id ON companies(primary_contact_user_id)
WHERE primary_contact_user_id IS NOT NULL;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS technician_user_id INT REFERENCES users(id),
ADD COLUMN IF NOT EXISTS technician_name TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_technician_user_id ON reports(technician_user_id)
WHERE technician_user_id IS NOT NULL;
