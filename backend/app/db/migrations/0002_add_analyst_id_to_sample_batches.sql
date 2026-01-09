-- Migration: Add analyst_id column to sample_batches table
-- This migration adds the missing analyst_id column that is referenced in laboratory queries

-- Add analyst_id column to sample_batches table
ALTER TABLE sample_batches
ADD COLUMN analyst_id INT REFERENCES users(id);

-- Create index for performance
CREATE INDEX idx_sample_batches_analyst_id ON sample_batches(analyst_id);