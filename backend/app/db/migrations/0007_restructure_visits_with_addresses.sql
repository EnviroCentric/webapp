-- Migration: Restructure project visits to include address data directly
-- - Drop existing project_visits and addresses tables entirely
-- - Create new project_visits table with embedded address fields
-- - Update related tables to remove address_id references

-- Step 1: Drop existing tables and constraints
DROP TABLE IF EXISTS project_visits CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;

-- Step 2: Remove address_id from samples and reports tables
ALTER TABLE samples DROP COLUMN IF EXISTS address_id;
ALTER TABLE reports DROP COLUMN IF EXISTS address_id;

-- Step 3: Create new project_visits table with embedded address data
CREATE TABLE project_visits (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    technician_id INT REFERENCES users(id),
    notes TEXT,
    description TEXT, -- Location-specific name (e.g., "Warehouse A", "Building 1")
    
    -- Traditional address fields (legacy/manual entry)
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    
    -- Google Places integration fields
    formatted_address TEXT,
    google_place_id VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    place_types TEXT[], -- Array of place types from Google
    
    -- Enhanced Google Places address components
    country VARCHAR(2), -- ISO country code
    postal_code VARCHAR(20),
    administrative_area_level_1 TEXT, -- State/province
    administrative_area_level_2 TEXT, -- County
    locality TEXT, -- City
    sublocality TEXT, -- Neighborhood/district
    route TEXT, -- Street name
    street_number TEXT, -- Street number
    plus_code TEXT, -- Google Plus Code
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Update samples table to reference visits only
-- Samples are collected during visits, so visit_id is sufficient
-- (samples table already has visit_id, so no changes needed to samples structure)

-- Step 5: Add indexes for performance
CREATE INDEX idx_project_visits_project_id ON project_visits(project_id);
CREATE INDEX idx_project_visits_technician_id ON project_visits(technician_id);
CREATE INDEX idx_project_visits_date ON project_visits(visit_date);
CREATE INDEX idx_project_visits_google_place_id ON project_visits(google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX idx_project_visits_location ON project_visits(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_project_visits_locality ON project_visits(locality) WHERE locality IS NOT NULL;
CREATE INDEX idx_project_visits_admin_area ON project_visits(administrative_area_level_1) WHERE administrative_area_level_1 IS NOT NULL;
CREATE INDEX idx_project_visits_postal_code ON project_visits(postal_code) WHERE postal_code IS NOT NULL;
CREATE INDEX idx_project_visits_place_types ON project_visits USING GIN(place_types) WHERE place_types IS NOT NULL;
CREATE INDEX idx_project_visits_description ON project_visits(description) WHERE description IS NOT NULL;

-- Step 6: Add helpful comments
COMMENT ON TABLE project_visits IS 'Project visits with embedded address information. Each visit represents a specific location visit for sample collection.';
COMMENT ON COLUMN project_visits.description IS 'Location-specific description/name for this visit (e.g., "Warehouse A", "Building 1")';
COMMENT ON COLUMN project_visits.google_place_id IS 'Unique Google Places ID for this visit location';
COMMENT ON COLUMN project_visits.formatted_address IS 'Google-formatted address string for this visit location';
COMMENT ON COLUMN project_visits.place_types IS 'Array of Google Places types for this location (e.g., establishment, point_of_interest)';
COMMENT ON COLUMN project_visits.locality IS 'City name from Google Places (preferred over city column)';
COMMENT ON COLUMN project_visits.administrative_area_level_1 IS 'State/province from Google Places (preferred over state column)';
COMMENT ON COLUMN project_visits.address_line1 IS 'Street address (manual entry or from address_line1)';
COMMENT ON COLUMN project_visits.city IS 'City name (legacy field, prefer locality)';
COMMENT ON COLUMN project_visits.state IS 'State abbreviation (legacy field, prefer administrative_area_level_1)';
COMMENT ON COLUMN project_visits.zip IS 'ZIP/postal code (legacy field, prefer postal_code)';