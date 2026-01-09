-- name: create_user_roles_view
CREATE OR REPLACE VIEW user_roles_view AS
SELECT 
    ur.user_id,
    r.id,
    r.name,
    r.description,
    r.level,
    r.created_at
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id;

-- name: drop_user_roles_view
DROP VIEW IF EXISTS user_roles_view;
