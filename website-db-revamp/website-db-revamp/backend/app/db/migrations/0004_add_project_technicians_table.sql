-- Add project_technicians junction table for direct technician assignment to projects
-- This is separate from project_visits which track actual field work

CREATE TABLE project_technicians (
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    technician_id INT REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT REFERENCES users(id),
    PRIMARY KEY (project_id, technician_id)
);

-- Create indexes for performance
CREATE INDEX idx_project_technicians_project_id ON project_technicians(project_id);
CREATE INDEX idx_project_technicians_technician_id ON project_technicians(technician_id);
CREATE INDEX idx_project_technicians_assigned_by ON project_technicians(assigned_by);