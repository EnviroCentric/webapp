-- name: create_user_roles_with_permissions_view
CREATE OR REPLACE VIEW user_roles_with_permissions AS
SELECT 
    ur.user_id,
    r.id,
    r.name,
    r.description,
    r.level,
    r.created_at,
    COALESCE(array_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL), '{}') AS permissions
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY ur.user_id, r.id, r.name, r.description, r.level, r.created_at;

-- name: drop_user_roles_with_permissions_view
DROP VIEW IF EXISTS user_roles_with_permissions; 