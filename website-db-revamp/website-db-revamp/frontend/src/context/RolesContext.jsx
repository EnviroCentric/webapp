import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const RolesContext = createContext();

export function RolesProvider({ children }) {
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchInProgress = useRef(false);
  const lastFetchTime = useRef(0);
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

  const fetchRoles = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && roles.length > 0 && now - lastFetchTime.current < CACHE_DURATION) {
      return; // Use cached data if it's still valid
    }

    if (fetchInProgress.current) {
      return; // Prevent concurrent fetches
    }

    if (!token) return;
    
    setLoading(true);
    setError(null);
    try {
      fetchInProgress.current = true;
      const response = await api.get('/api/v1/roles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      setRoles(data);
      lastFetchTime.current = now;
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError(err.response?.data?.detail || 'Failed to fetch roles');
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, [token, roles.length]);

  const reorderRoles = async (roleOrders) => {
    try {
      const response = await api.put('/api/v1/roles/reorder', { role_orders: roleOrders });
      return response.data;
    } catch (error) {
      console.error('Error reordering roles:', error);
      throw error;
    }
  };

  const addRole = useCallback((newRole) => {
    setRoles(prevRoles => [...prevRoles, newRole]);
  }, []);

  const updateRole = useCallback((roleId, updates) => {
    setRoles(prevRoles => 
      prevRoles.map(role => 
        role.role_id === roleId
          ? { ...role, ...updates }
          : role
      )
    );
  }, []);

  const deleteRole = useCallback((roleId) => {
    setRoles(prevRoles => prevRoles.filter(role => role.role_id !== roleId));
  }, []);

  const formatRoleName = useCallback((name) => {
    return name
      .split(/[\s_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, []);

  const value = {
    roles,
    loading,
    error,
    fetchRoles,
    reorderRoles,
    addRole,
    updateRole,
    deleteRole,
    formatRoleName
  };

  return (
    <RolesContext.Provider value={value}>
      {children}
    </RolesContext.Provider>
  );
}

export function useRoles() {
  const context = useContext(RolesContext);
  if (!context) {
    throw new Error('useRoles must be used within a RolesProvider');
  }
  return context;
} 