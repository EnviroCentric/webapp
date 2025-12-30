-- Migration: Normalize addresses and project visits with enhanced Google Places support
-- - Remove name column from addresses table (addresses should be unique physical locations)
-- - Add description column to project_visits table (for location-specific naming/descriptions)
-- - Enhance address table with comprehensive Google Places data
-- - Migrate existing address names to project visit descriptions

-- Step 1: Add description column to project_visits table
ALTER TABLE project_visits ADD COLUMN IF NOT EXISTS description TEXT;

-- Step 2: Add enhanced Google Places fields to addresses if not already present
-- (Some may already exist from previous migrations)
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS place_types TEXT[], -- Array of place types from Google
ADD COLUMN IF NOT EXISTS country VARCHAR(2), -- ISO country code
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20), -- Separate postal code field
ADD COLUMN IF NOT EXISTS administrative_area_level_1 TEXT, -- State/province
ADD COLUMN IF NOT EXISTS administrative_area_level_2 TEXT, -- County
ADD COLUMN IF NOT EXISTS locality TEXT, -- City
ADD COLUMN IF NOT EXISTS sublocality TEXT, -- Neighborhood/district
ADD COLUMN IF NOT EXISTS route TEXT, -- Street name
ADD COLUMN IF NOT EXISTS street_number TEXT, -- Street number
ADD COLUMN IF NOT EXISTS plus_code TEXT; -- Google Plus Code

-- Step 3: Migrate existing address names to project visit descriptions
-- This handles cases where there are existing addresses with names
UPDATE project_visits 
SET description = addresses.name 
FROM addresses 
WHERE project_visits.address_id = addresses.id 
AND addresses.name IS NOT NULL 
AND addresses.name != ''
AND (project_visits.description IS NULL OR project_visits.description = '');

-- Step 3: Add unique constraint on addresses to ensure no duplicate physical addresses
-- First, we need to remove any existing duplicates by merging them
-- Create a temporary table to track address merging
CREATE TEMP TABLE address_duplicates AS
SELECT 
    MIN(id) as keep_id,
    array_agg(id ORDER BY id) as all_ids,
    address_line1,
    COALESCE(city, '') as city,
    COALESCE(state, '') as state
FROM addresses 
WHERE address_line1 IS NOT NULL
GROUP BY address_line1, COALESCE(city, ''), COALESCE(state, '')
HAVING COUNT(*) > 1;

-- Update project_visits to use the earliest (keep_id) address for duplicates
UPDATE project_visits 
SET address_id = ad.keep_id
FROM address_duplicates ad
WHERE address_id = ANY(ad.all_ids) 
AND address_id != ad.keep_id;

-- Update samples to use the earliest address for duplicates
UPDATE samples 
SET address_id = ad.keep_id
FROM address_duplicates ad
WHERE address_id = ANY(ad.all_ids) 
AND address_id != ad.keep_id;

-- Update reports to use the earliest address for duplicates
UPDATE reports 
SET address_id = ad.keep_id
FROM address_duplicates ad
WHERE address_id = ANY(ad.all_ids) 
AND address_id != ad.keep_id;

-- Delete the duplicate addresses
DELETE FROM addresses 
WHERE id IN (
    SELECT unnest(all_ids[2:]) 
    FROM address_duplicates
);

-- Step 4: Drop the name column from addresses table
ALTER TABLE addresses DROP COLUMN name;

-- Step 5: Add unique constraints and indexes for addresses
-- Primary constraint: Google Place ID should be unique if it exists
CREATE UNIQUE INDEX IF NOT EXISTS unique_google_place_id 
ON addresses (google_place_id) WHERE google_place_id IS NOT NULL AND google_place_id != '';

-- Secondary constraint: Formatted address should be unique if it exists (for non-Google addresses)
CREATE UNIQUE INDEX IF NOT EXISTS unique_formatted_address 
ON addresses (formatted_address) WHERE formatted_address IS NOT NULL AND formatted_address != '';

-- Fallback constraint: Traditional address components for manual entries
CREATE UNIQUE INDEX IF NOT EXISTS unique_manual_address 
ON addresses (address_line1, COALESCE(locality, ''), COALESCE(administrative_area_level_1, ''), COALESCE(postal_code, '')) 
WHERE google_place_id IS NULL AND formatted_address IS NULL;

-- Step 6: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_visits_description ON project_visits(description);
CREATE INDEX IF NOT EXISTS idx_addresses_location ON addresses(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addresses_locality ON addresses(locality);
CREATE INDEX IF NOT EXISTS idx_addresses_admin_area ON addresses(administrative_area_level_1);
CREATE INDEX IF NOT EXISTS idx_addresses_postal_code ON addresses(postal_code);
CREATE INDEX IF NOT EXISTS idx_addresses_place_types ON addresses USING GIN(place_types) WHERE place_types IS NOT NULL;

-- Step 7: Add helpful comments
COMMENT ON TABLE addresses IS 'Stores unique physical addresses without descriptive names. Uses Google Places data when available.';
COMMENT ON COLUMN project_visits.description IS 'Location-specific description/name for this visit (e.g., "Warehouse A", "Building 1")';
COMMENT ON COLUMN addresses.google_place_id IS 'Unique Google Places ID for this address';
COMMENT ON COLUMN addresses.formatted_address IS 'Google-formatted address string';
COMMENT ON COLUMN addresses.place_types IS 'Array of Google Places types (e.g., establishment, point_of_interest)';
COMMENT ON COLUMN addresses.locality IS 'City name from Google Places (preferred over city column)';
COMMENT ON COLUMN addresses.administrative_area_level_1 IS 'State/province from Google Places (preferred over state column)';
