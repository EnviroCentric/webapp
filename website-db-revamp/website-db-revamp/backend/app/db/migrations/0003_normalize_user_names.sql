-- Migration: 0003_normalize_user_names.sql
-- Description: Normalize existing user first_name and last_name to lowercase
-- This ensures data consistency with new validation rules

-- Update existing users to have lowercase names
UPDATE users 
SET 
    first_name = LOWER(first_name),
    last_name = LOWER(last_name),
    updated_at = CURRENT_TIMESTAMP
WHERE 
    first_name != LOWER(first_name) OR 
    last_name != LOWER(last_name);

-- Add a comment to document this change
COMMENT ON COLUMN users.first_name IS 'User first name (normalized to lowercase)';
COMMENT ON COLUMN users.last_name IS 'User last name (normalized to lowercase)';