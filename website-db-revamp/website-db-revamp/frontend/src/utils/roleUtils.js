/**
 * Utility functions for formatting role names and descriptions for user-facing display
 */

/**
 * Formats a role name for user-facing display
 * Converts underscores to spaces and capitalizes each word
 * @param {string} roleName - The role name (e.g., "field_tech", "lab_tech")
 * @returns {string} - Formatted role name (e.g., "Field Tech", "Lab Tech")
 */
export function formatRoleName(roleName) {
  if (!roleName || typeof roleName !== 'string') {
    return 'Unnamed Role';
  }

  return roleName
    // Replace underscores with spaces
    .replace(/_/g, ' ')
    // Split by spaces and capitalize each word
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formats a role description for display
 * Simply capitalizes the first letter of the description
 * @param {string} description - The role description
 * @returns {string} - Formatted description
 */
export function formatRoleDescription(description) {
  if (!description || typeof description !== 'string') {
    return '';
  }

  return description.charAt(0).toUpperCase() + description.slice(1);
}

/**
 * Gets a user-friendly role display with optional level
 * @param {Object} role - Role object with name and optionally level
 * @param {boolean} showLevel - Whether to show the level in parentheses
 * @returns {string} - Formatted role display
 */
export function formatRoleDisplay(role, showLevel = false) {
  if (!role) {
    return 'Unnamed Role';
  }

  const formattedName = formatRoleName(role.name);
  
  if (showLevel && role.level !== undefined && role.level !== null) {
    return `${formattedName} (Level ${role.level})`;
  }
  
  return formattedName;
}

/**
 * Sorts roles by level (highest first) and then by name
 * @param {Array} roles - Array of role objects
 * @returns {Array} - Sorted array of roles
 */
export function sortRolesByLevel(roles) {
  if (!Array.isArray(roles)) {
    return [];
  }

  return [...roles].sort((a, b) => {
    // First sort by level (highest first)
    const levelA = a.level || 0;
    const levelB = b.level || 0;
    
    if (levelA !== levelB) {
      return levelB - levelA;
    }
    
    // If levels are equal, sort by name
    const nameA = formatRoleName(a.name || '');
    const nameB = formatRoleName(b.name || '');
    
    return nameA.localeCompare(nameB);
  });
}

/**
 * Gets the color class for a role badge based on the role level
 * @param {number} level - The role level
 * @returns {string} - Tailwind CSS classes for the badge
 */
export function getRoleBadgeClasses(level) {
  if (level >= 100) {
    // Admin
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  } else if (level >= 90) {
    // Manager
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  } else if (level >= 80) {
    // Supervisor
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  } else if (level >= 60) {
    // Lab Tech
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  } else if (level >= 50) {
    // Field Tech
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  } else if (level >= 10) {
    // Client
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
  } else {
    // Default/Unknown
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}