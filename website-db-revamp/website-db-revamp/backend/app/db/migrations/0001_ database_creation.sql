-- Company table (clients belong to one)
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Employees (same as current users but adds phone)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    highest_level SMALLINT NOT NULL DEFAULT 0
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    level INT NOT NULL DEFAULT 0 CONSTRAINT level_check CHECK (100 >= level AND level >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Junction table linking employees to roles.  We keep roles from previous
-- migrations (including their level column) and simply associate users
-- with roles here.  Actions are authorised by comparing role levels.
CREATE TABLE user_roles (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Insert initial roles with their levels for your workflow
INSERT INTO roles (name, description, level) VALUES
    ('admin', 'Administrator with full system access', 100),
    ('manager', 'Manager with elevated access', 90),
    ('supervisor', 'Supervisor with team management access', 80),
    ('field_tech', 'Field technician with sample collection access', 50),
    ('lab_tech', 'Lab technician with sample preparation and analysis access', 60),
    ('client', 'Client company user with view-only access', 10);

-- Projects with current lifecycle fields
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('open','closed','reopened')),
    current_start_date DATE,
    current_end_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Project lifecycle events
CREATE TABLE project_history (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('created','opened','closed','reopened','reclosed')),
    event_time TIMESTAMPTZ NOT NULL,
    notes TEXT
);

-- Full address record
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),       -- optional alias (“Warehouse A”)
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- A single visit to an address for a project/date
CREATE TABLE project_visits (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    address_id INT REFERENCES addresses(id),
    visit_date DATE NOT NULL,
    technician_id INT REFERENCES users(id),  -- single tech per record
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- PA samples, linked to a visit and project/address
CREATE TABLE samples (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    address_id INT REFERENCES addresses(id),
    visit_id INT REFERENCES project_visits(id),
    collected_by INT REFERENCES users(id),
    collected_at TIMESTAMPTZ NOT NULL,
    description TEXT,
    is_inside BOOLEAN,
    flow_rate INT DEFAULT 12,
    volume_required INT DEFAULT 1000,
    -- timing for a sample is tracked via the sample_time_events table; individual
    -- start/stop columns are intentionally omitted to prevent accidental
    -- overwrites when restarting a sample collection.
    sample_status VARCHAR(20) NOT NULL CHECK (sample_status IN ('collected','prepared','analyzed','qa_checked','rejected')),
    reject_reason VARCHAR(20) CHECK (reject_reason IN ('wet','torn','missing')),
    cassette_barcode TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- A batch of samples prepared for analysis
CREATE TABLE sample_batches (
    id SERIAL PRIMARY KEY,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_closed BOOLEAN DEFAULT FALSE,
    closed_at TIMESTAMPTZ,
    notes TEXT
);

-- Links a sample to a specific slide/position in a batch
CREATE TABLE batch_samples (
    id SERIAL PRIMARY KEY,
    batch_id INT REFERENCES sample_batches(id) ON DELETE CASCADE,
    sample_id INT REFERENCES samples(id) ON DELETE CASCADE,
    color VARCHAR(50) NOT NULL,         -- e.g. 'Blue' or 'Red'
    slide_number INT NOT NULL,          -- e.g. '5' for the “Blue 5” slide
    position INT NOT NULL CHECK (position IN (1,2)),  -- 1 or 2 on that slide
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (batch_id, color, slide_number, position)
);

-- Each analysis or reanalysis of a sample
CREATE TABLE analysis_runs (
    id SERIAL PRIMARY KEY,
    sample_id INT REFERENCES samples(id),
    batch_sample_id INT REFERENCES batch_samples(id),
    run_number INT NOT NULL,
    analyzed_by INT REFERENCES users(id),
    analysis_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    total_fields INT DEFAULT 100,
    total_fibers INT,
    is_overload BOOLEAN,
    is_qa_run BOOLEAN DEFAULT FALSE,
    qa_reviewed_by INT REFERENCES users(id),
    qa_review_time TIMESTAMPTZ,
    qa_total_fibers INT,
    qa_difference INT,
    is_within_tolerance BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Fiber counts per microscope field (1–100) for each analysis run
CREATE TABLE field_counts (
    id SERIAL PRIMARY KEY,
    analysis_run_id INT REFERENCES analysis_runs(id) ON DELETE CASCADE,
    field_number INT NOT NULL CHECK (field_number BETWEEN 1 AND 100),
    fibers_count INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (analysis_run_id, field_number)
);

CREATE TABLE sample_time_events (
    id SERIAL PRIMARY KEY,
    sample_id INT REFERENCES samples(id) ON DELETE CASCADE,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('start','stop')),
    event_time TIMESTAMPTZ NOT NULL,
    recorded_by INT REFERENCES users(id),       -- tech who triggered it
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Reports generated for completed project addresses
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    address_id INT REFERENCES addresses(id),
    report_name VARCHAR(255) NOT NULL,
    report_file_path TEXT,  -- Path to generated PDF/document
    generated_by INT REFERENCES users(id),
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    report_data JSONB,  -- Store report calculations/data
    is_final BOOLEAN DEFAULT FALSE,
    client_visible BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_company_id ON projects(company_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_visits_project_id ON project_visits(project_id);
CREATE INDEX idx_project_visits_technician_id ON project_visits(technician_id);
CREATE INDEX idx_project_visits_date ON project_visits(visit_date);
CREATE INDEX idx_samples_project_id ON samples(project_id);
CREATE INDEX idx_samples_visit_id ON samples(visit_id);
CREATE INDEX idx_samples_status ON samples(sample_status);
CREATE INDEX idx_samples_collected_by ON samples(collected_by);
CREATE INDEX idx_analysis_runs_sample_id ON analysis_runs(sample_id);
CREATE INDEX idx_analysis_runs_analyzed_by ON analysis_runs(analyzed_by);
CREATE INDEX idx_reports_project_id ON reports(project_id);
CREATE INDEX idx_reports_address_id ON reports(address_id);
CREATE INDEX idx_reports_client_visible ON reports(client_visible);
