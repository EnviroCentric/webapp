import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook for checking user permissions and roles
 * This follows your preference for token-based permissions over role-based permissions
 */
export function usePermissions() {
  const { user, isAuthenticated } = useAuth();

  return useMemo(() => {
    if (!isAuthenticated || !user) {
      return {
        // Basic checks
        isAuthenticated: false,
        isSuperuser: false,
        userLevel: 0,
        userRoles: [],
        
        // Level-based checks
        isAdmin: false,
        isManager: false,
        isSupervisor: false,
        isLabTech: false,
        isFieldTech: false,
        isClient: false,
        
        // Permission methods
        hasMinLevel: () => false,
        hasRole: () => false,
        hasAnyRole: () => false,
        hasPermission: () => false,
        canAccessRoute: () => false,
        canManageUsers: () => false,
        canManageRoles: () => false,
        canManageProjects: () => false,
        canCollectSamples: () => false,
        canAnalyzeSamples: () => false,
        canViewReports: () => false,
      };
    }

    // Calculate user level - superusers get effective infinite level
    let userLevel;
    if (user.is_superuser) {
      userLevel = Number.MAX_SAFE_INTEGER; // Effectively infinite level
    } else {
      userLevel = user.highest_level || Math.max(...(user.roles?.map(role => role.level) || [0]));
    }
    
    const userRoles = user.roles?.map(role => role.name.toLowerCase()) || [];
    const userPermissions = user.roles?.flatMap(role => role.permissions || []) || [];

    return {
      // Basic user info
      isAuthenticated: true,
      isSuperuser: Boolean(user.is_superuser),
      userLevel,
      userRoles,
      userPermissions,
      
      // Level-based role checks
      isAdmin: userLevel >= 100 || user.is_superuser,
      isManager: userLevel >= 90,
      isSupervisor: userLevel >= 80,
      isLabTech: userLevel >= 60,
      isFieldTech: userLevel >= 50,
      isClient: userLevel >= 10,
      
      // Permission checking methods
      hasMinLevel: (minLevel) => user.is_superuser || userLevel >= minLevel,
      
      hasRole: (roleName) => {
        if (user.is_superuser) return true;
        return userRoles.includes(roleName.toLowerCase());
      },
      
      hasAnyRole: (roleNames) => {
        if (user.is_superuser) return true;
        return roleNames.some(roleName => userRoles.includes(roleName.toLowerCase()));
      },
      
      hasPermission: (permission) => {
        if (user.is_superuser) return true;
        return userPermissions.includes(permission);
      },
      
      // Route access control
      canAccessRoute: (routeConfig) => {
        if (user.is_superuser) return true;
        
        if (routeConfig.requireSuperuser) return false;
        if (routeConfig.minLevel && userLevel < routeConfig.minLevel) return false;
        if (routeConfig.allowedRoles?.length > 0) {
          return routeConfig.allowedRoles.some(role => userRoles.includes(role.toLowerCase()));
        }
        if (routeConfig.requiredPermissions?.length > 0) {
          return routeConfig.requiredPermissions.every(perm => userPermissions.includes(perm));
        }
        
        return true;
      },
      
      // Specific business logic permissions
      canManageUsers: () => {
        return user.is_superuser || userLevel >= 80; // Supervisor or higher
      },
      
      canManageRoles: () => {
        return user.is_superuser || userLevel >= 100; // Admin or superuser only
      },
      
      canManageProjects: () => {
        return user.is_superuser || userLevel >= 80; // Supervisor or higher
      },
      
      canCollectSamples: () => {
        return user.is_superuser || userLevel >= 50; // Field tech or higher
      },
      
      canAnalyzeSamples: () => {
        return user.is_superuser || userLevel >= 60; // Lab tech or higher
      },
      
      canViewReports: () => {
        return user.is_superuser || userLevel >= 10; // All authenticated users
      },
      
      // Advanced permission checks
      canEditUser: (targetUser) => {
        if (user.is_superuser) return true;
        if (targetUser.id === user.id) return true; // Can edit self
        
        const targetUserLevel = targetUser.highest_level || 
          Math.max(...(targetUser.roles?.map(role => role.level) || [0]));
        
        return userLevel > targetUserLevel; // Can only edit users with lower levels
      },
      
      canAssignRole: (roleLevel) => {
        if (user.is_superuser) return true;
        return userLevel > roleLevel; // Can only assign roles below their level
      },
    };
  }, [user, isAuthenticated]);
}

/**
 * Hook specifically for component visibility based on permissions
 */
export function useShowIfPermitted() {
  const permissions = usePermissions();
  
  return {
    showIfMinLevel: (minLevel) => permissions.hasMinLevel(minLevel),
    showIfRole: (roleName) => permissions.hasRole(roleName),
    showIfAnyRole: (roleNames) => permissions.hasAnyRole(roleNames),
    showIfSuperuser: () => permissions.isSuperuser,
    showIfCanManageUsers: () => permissions.canManageUsers(),
    showIfCanManageProjects: () => permissions.canManageProjects(),
  };
}

/**
 * Component wrapper for conditional rendering based on permissions
 */
export function ShowIf({ condition, children, fallback = null }) {
  return condition ? children : fallback;
}

/**
 * Higher-order component for permission-based component wrapping
 */
export function withPermissions(Component, permissionCheck) {
  return function PermissionWrappedComponent(props) {
    const permissions = usePermissions();
    const hasPermission = permissionCheck(permissions);
    
    if (!hasPermission) {
      return null;
    }
    
    return <Component {...props} />;
  };
}

export default usePermissions;