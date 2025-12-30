import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext();

export function PermissionsProvider({ children }) {
  const { token } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchInProgress = useRef(false);
  const rolePermissionsFetchInProgress = useRef({});

  const fetchPermissions = useCallback(async () => {
    if (permissions.length > 0 || fetchInProgress.current) return; // Already loaded or in progress

    try {
      fetchInProgress.current = true;
      setIsLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/roles/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch permissions');
      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [token, permissions.length]);

  const fetchRolePermissions = useCallback(async (roles) => {
    if (!roles.length) return;

    // Filter out roles that are already being fetched or have permissions
    const rolesToFetch = roles.filter(role => 
      !rolePermissionsFetchInProgress.current[role.role_id] && 
      !rolePermissions[role.role_id]
    );

    if (!rolesToFetch.length) return;

    try {
      setIsLoading(true);
      
      // Mark roles as being fetched
      rolesToFetch.forEach(role => {
        rolePermissionsFetchInProgress.current[role.role_id] = true;
      });

      const rolePermissionsPromises = rolesToFetch.map(role =>
        fetch(`${import.meta.env.VITE_API_URL}/roles/${role.role_id}/permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(res => res.json())
      );

      const results = await Promise.all(rolePermissionsPromises);
      
      const rolePermissionsMap = {};
      rolesToFetch.forEach((role, index) => {
        const roleData = results[index];
        let permissions = [];
        
        if (Array.isArray(roleData)) {
          permissions = roleData;
        } else if (roleData && Array.isArray(roleData.permissions)) {
          permissions = roleData.permissions;
        } else if (roleData && Array.isArray(roleData.role_permissions)) {
          permissions = roleData.role_permissions.map(rp => rp.permission_name || rp.permission.name);
        }
        
        rolePermissionsMap[role.role_id] = permissions.map(p => 
          typeof p === 'object' ? (p.name || p.permission_name) : p
        );
      });

      setRolePermissions(prev => ({ ...prev, ...rolePermissionsMap }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      // Clear fetch in progress flags
      rolesToFetch.forEach(role => {
        rolePermissionsFetchInProgress.current[role.role_id] = false;
      });
    }
  }, [token, rolePermissions]);

  const updateRolePermissions = useCallback((roleId, newPermissions) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: newPermissions
    }));
  }, []);

  const formatPermissionName = useCallback((name) => {
    return name.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }, []);

  const value = {
    permissions,
    rolePermissions,
    isLoading,
    error,
    fetchPermissions,
    fetchRolePermissions,
    updateRolePermissions,
    formatPermissionName
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
} 