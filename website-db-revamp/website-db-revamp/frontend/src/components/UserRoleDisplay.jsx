import React from 'react';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import { formatRoleName, getRoleBadgeClasses } from '../utils/roleUtils';

/**
 * Component to display current user's role information and capabilities
 * Useful for debugging and user understanding of their permissions
 */
export default function UserRoleDisplay({ showDetails = false }) {
  const { user } = useAuth();
  const permissions = usePermissions();

  if (!permissions.isAuthenticated) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          User Permissions
        </h3>
        {permissions.isSuperuser && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            SUPERUSER
          </span>
        )}
      </div>

      {/* User Info */}
      <div className="mb-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">User:</span> {user.first_name} {user.last_name}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Email:</span> {user.email}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Level:</span> {permissions.isSuperuser ? 'Superuser (∞)' : permissions.userLevel}
        </div>
      </div>

      {/* Roles */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Current Roles:
        </div>
        <div className="flex flex-wrap gap-2">
          {user.roles && user.roles.length > 0 ? (
            user.roles.map((role) => {
              const badgeClasses = getRoleBadgeClasses(role?.level || 0);
              return (
                <span
                  key={role.id}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClasses}`}
                >
                  {formatRoleName(role.name)} (Level {role.level})
                </span>
              );
            })
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">No roles assigned</span>
          )}
        </div>
      </div>

      {/* Capabilities Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CapabilityItem 
          label="Manage Users" 
          allowed={permissions.canManageUsers()} 
        />
        <CapabilityItem 
          label="Manage Projects" 
          allowed={permissions.canManageProjects()} 
        />
        <CapabilityItem 
          label="Collect Samples" 
          allowed={permissions.canCollectSamples()} 
        />
        <CapabilityItem 
          label="Analyze Samples" 
          allowed={permissions.canAnalyzeSamples()} 
        />
        <CapabilityItem 
          label="View Reports" 
          allowed={permissions.canViewReports()} 
        />
        <CapabilityItem 
          label="Manage Roles" 
          allowed={permissions.canManageRoles()} 
        />
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Access Levels:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            <AccessLevelItem label="Admin" level={100} userLevel={permissions.userLevel} />
            <AccessLevelItem label="Manager" level={90} userLevel={permissions.userLevel} />
            <AccessLevelItem label="Supervisor" level={80} userLevel={permissions.userLevel} />
            <AccessLevelItem label="Lab Tech" level={60} userLevel={permissions.userLevel} />
            <AccessLevelItem label="Field Tech" level={50} userLevel={permissions.userLevel} />
            <AccessLevelItem label="Client" level={10} userLevel={permissions.userLevel} />
          </div>
        </div>
      )}
    </div>
  );
}

function CapabilityItem({ label, allowed }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-700">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex items-center">
        {allowed ? (
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
    </div>
  );
}

function AccessLevelItem({ label, level, userLevel }) {
  const hasAccess = userLevel >= level;
  
  return (
    <div className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
      hasAccess 
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
    }`}>
      <span>{label}</span>
      <span>L{level}</span>
    </div>
  );
}

/**
 * Compact version for displaying in headers/navbars
 */
export function UserRoleBadge() {
  const { user } = useAuth();
  const permissions = usePermissions();

  if (!permissions.isAuthenticated) {
    return null;
  }

  const getHighestRoleName = () => {
    if (permissions.isSuperuser) return 'Superuser';
    if (permissions.isAdmin) return 'Admin';
    if (permissions.isManager) return 'Manager';
    if (permissions.isSupervisor) return 'Supervisor';
    if (permissions.isLabTech) return 'Lab Tech';
    if (permissions.isFieldTech) return 'Field Tech';
    if (permissions.isClient) return 'Client';
    return 'User';
  };

  const getBadgeColor = () => {
    if (permissions.isSuperuser) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    if (permissions.isAdmin) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (permissions.isManager) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    if (permissions.isSupervisor) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (permissions.isLabTech) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (permissions.isFieldTech) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColor()}`}>
      {getHighestRoleName()} ({permissions.isSuperuser ? '∞' : `L${permissions.userLevel}`})
    </span>
  );
}