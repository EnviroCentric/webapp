/**
 * Determines the appropriate default redirect page based on user role/permission level
 * Aligns with token-based permission preferences and role hierarchy
 */
export function getDefaultRedirectPath(user) {
  if (!user) {
    return '/';
  }

  // Calculate user level - superusers get effective infinite level
  let userLevel;
  if (user.is_superuser) {
    userLevel = Number.MAX_SAFE_INTEGER;
  } else {
    userLevel = user.highest_level || Math.max(...(user.roles?.map(role => role.level) || [0]));
  }

  // Redirect based on user level/capabilities
  // Admin/Manager/Supervisor (80+) - can access dashboard and manage projects
  if (userLevel >= 80 || user.is_superuser) {
    return '/dashboard';
  }
  
  // Technicians (50-79) - can access dashboard and collect samples
  if (userLevel >= 50) {
    return '/dashboard';
  }
  
  // Client level (10-49) - basic authenticated user, redirect to profile
  if (userLevel >= 10) {
    return '/profile';
  }
  
  // Default user (level 0-9) - redirect to home page
  return '/';
}

/**
 * Gets a user-friendly description of where they're being redirected and why
 */
export function getRedirectReason(user) {
  if (!user) {
    return 'Redirecting to home page';
  }

  let userLevel;
  if (user.is_superuser) {
    userLevel = Number.MAX_SAFE_INTEGER;
  } else {
    userLevel = user.highest_level || Math.max(...(user.roles?.map(role => role.level) || [0]));
  }

  if (userLevel >= 80 || user.is_superuser) {
    return 'Redirecting to dashboard - you have management level access';
  }
  
  if (userLevel >= 50) {
    return 'Redirecting to dashboard - you have technician level access';
  }
  
  if (userLevel >= 10) {
    return 'Redirecting to your profile - you have client level access';
  }
  
  return 'Redirecting to home page - please contact an administrator to assign your role';
}