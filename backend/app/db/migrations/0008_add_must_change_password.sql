-- Migration: Add must_change_password flag for forced password reset on first login
--
-- Clients created by admins receive a default password and must change it on first login.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_must_change_password ON users(must_change_password);
