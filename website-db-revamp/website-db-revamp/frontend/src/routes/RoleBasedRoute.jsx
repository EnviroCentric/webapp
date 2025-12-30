import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Role-based route protection component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Components to render if access is granted
 * @param {number} props.minLevel - Minimum role level required (optional)
 * @param {string[]} props.allowedRoles - Specific role names allowed (optional)
 * @param {string[]} props.requiredPermissions - Required permissions (optional)
 * @param {boolean} props.requireSuperuser - Whether superuser access is required
 * @param {string} props.redirectTo - Where to redirect if access is denied (default: '/')
 * @param {boolean} props.showForbidden - Show forbidden message instead of redirecting
 */
export default function RoleBasedRoute({ 
  children, 
  minLevel = 0, 
  allowedRoles = [],
  requiredPermissions = [],
  requireSuperuser = false,
  redirectTo = '/',
  showForbidden = false
}) {
  const { user, isAuthenticated, loading } = useAuth();

  // Show loading spinner while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Check superuser requirement
  if (requireSuperuser && !user?.is_superuser) {
    if (showForbidden) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400">You do not have the required permissions to access this page.</p>
          </div>
        </div>
      );
    }
    return <Navigate to={redirectTo} replace />;
  }

  // Check role level requirement
  if (minLevel > 0) {
    // For superusers, give them infinite level access
    if (user?.is_superuser) {
      // Superuser bypasses level checks
    } else {
      const userHighestLevel = user?.highest_level || Math.max(...(user?.roles?.map(role => role.level) || [0]));
        if (userHighestLevel < minLevel) {
          if (showForbidden) {
            return (
              <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Insufficient Permissions</h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    You do not have the required permissions to access this page.
                  </p>
                </div>
              </div>
            );
          }
          return <Navigate to={redirectTo} replace />;
        }
      }
    }

  // Check specific role names
  if (allowedRoles.length > 0) {
    const userRoles = user?.roles?.map(role => role.name.toLowerCase()) || [];
    const hasAllowedRole = allowedRoles.some(roleName => 
      userRoles.includes(roleName.toLowerCase())
    );
    
    if (!hasAllowedRole) {
      if (showForbidden) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
              <p className="text-gray-600 dark:text-gray-400">
                You do not have the required permissions to access this page.
              </p>
            </div>
          </div>
        );
      }
      return <Navigate to={redirectTo} replace />;
    }
  }

  // Check required permissions
  if (requiredPermissions.length > 0) {
    const userPermissions = user?.roles?.flatMap(role => role.permissions || []) || [];
    const hasRequiredPermissions = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasRequiredPermissions) {
      if (showForbidden) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
              <p className="text-gray-600 dark:text-gray-400">
                You do not have the required permissions to access this page.
              </p>
            </div>
          </div>
        );
      }
      return <Navigate to={redirectTo} replace />;
    }
  }

  // All checks passed, render the protected content
  return children;
}

/**
 * Utility component for specific role checks
 */
export function RequireAdmin({ children, showForbidden = false }) {
  return (
    <RoleBasedRoute 
      minLevel={100} 
      showForbidden={showForbidden}
    >
      {children}
    </RoleBasedRoute>
  );
}

export function RequireManager({ children, showForbidden = false }) {
  return (
    <RoleBasedRoute 
      minLevel={90} 
      showForbidden={showForbidden}
    >
      {children}
    </RoleBasedRoute>
  );
}

export function RequireSupervisor({ children, showForbidden = false }) {
  return (
    <RoleBasedRoute 
      minLevel={80} 
      showForbidden={showForbidden}
    >
      {children}
    </RoleBasedRoute>
  );
}

export function RequireLabTech({ children, showForbidden = false }) {
  return (
    <RoleBasedRoute 
      minLevel={60} 
      showForbidden={showForbidden}
    >
      {children}
    </RoleBasedRoute>
  );
}

export function RequireTechnician({ children, showForbidden = false }) {
  return (
    <RoleBasedRoute 
      minLevel={50} 
      showForbidden={showForbidden}
    >
      {children}
    </RoleBasedRoute>
  );
}

export function RequireSuperuser({ children, showForbidden = false }) {
  return (
    <RoleBasedRoute 
      requireSuperuser={true}
      showForbidden={showForbidden}
    >
      {children}
    </RoleBasedRoute>
  );
}

/**
 * Require Client role with company assignment (but not admin)
 */
export function RequireClient({ children, showForbidden = false }) {
  const { user, isAuthenticated, loading } = useAuth();
  
  // Show loading spinner while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // Check if user has Client role, is assigned to a company, and is NOT admin
  const hasClientRole = user?.roles?.some(role => role.name.toLowerCase() === 'client');
  const userRoleLevel = Math.max(...(user?.roles?.map(role => role.level) || [0]));
  const isAdmin = userRoleLevel >= 100;
  const isValidClient = hasClientRole && user?.company_id && !isAdmin;
  
  if (!isValidClient) {
    if (showForbidden) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0h3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0v-5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400">
              You do not have the required permissions to access this page.
            </p>
          </div>
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }
  
  return children;
}
