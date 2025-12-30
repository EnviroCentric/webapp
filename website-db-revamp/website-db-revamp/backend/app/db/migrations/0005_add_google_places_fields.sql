-- Migration: Add Google Places integration fields to addresses table
-- Date: 2024-10-02
-- Description: Adds formatted_address, google_place_id, latitude, and longitude columns to support Google Places API integration

-- Add Google Places integration fields to addresses table
ALTER TABLE addresses 
ADD COLUMN formatted_address TEXT,
ADD COLUMN google_place_id VARCHAR(255),
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

-- Create index on google_place_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_addresses_google_place_id ON addresses(google_place_id);

-- Create index on latitude/longitude for spatial queries
CREATE INDEX IF NOT EXISTS idx_addresses_location ON addresses(latitude, longitude);