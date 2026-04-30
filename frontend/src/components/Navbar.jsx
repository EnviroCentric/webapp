import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import Login from '../pages/Login';

const navigation = [
  { name: "Home", href: "/" },
  { name: "Services", href: "/services" },
  { name: "Info", href: "/info" },
  { name: "Dashboard", href: "/dashboard", requiresTechnician: true },
  { name: "Projects", href: "/projects", requiresSupervisor: true },
  { name: "Companies", href: "/companies", requiresSupervisor: true },
  { name: "My Company", href: "/company/me", requiresClient: true },
  { name: "Upload Report", href: "/reports/upload", requiresManager: true },
  { name: "Admin", href: "/admin", requiresAdmin: true },
];

const userMenuOptions = [
  { name: "Profile", href: "/profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { name: "User Management", href: "/user-management", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { name: "Logout", action: "logout", icon: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" }
];

export default function Navbar() {
  const { isAuthenticated, logout, user } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const profileMenuRef = useRef(null);

  const isHomePage = location.pathname === '/';
  const userRoles = user?.roles || [];
  const isSuperuser = user?.is_superuser || userRoles.some(role => (role.name || '').toLowerCase() === 'admin');
  const userRoleLevel = Math.max(0, ...(userRoles.map(role => role.level || 0)));
  const hasClientRole = userRoles.some(role => (role.name || '').toLowerCase() === 'client');
  const isClient = !!(hasClientRole && user?.company_id && userRoleLevel < 100);

  const getUserInitials = () => {
    if (!user?.first_name && !user?.last_name) return null;

    const firstInitial = user.first_name ? user.first_name[0].toUpperCase() : '';
    const lastInitial = user.last_name ? user.last_name[0].toUpperCase() : '';
    return `${firstInitial}${lastInitial}`;
  };


  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    navigate('/');
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Navigation Links */}
            <div className="flex items-center">
              {/* Mobile menu button - left side */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-900 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 mr-3"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              {!isHomePage && (
                <div className="flex-shrink-0">
                  <Link to="/" className="flex items-center">
                    <img
                      src={logo}
                      alt="Enviro-Centric Logo"
                      className="h-8 sm:h-10 md:h-12 w-auto"
                      loading="eager"
                      decoding="async"
                    />
                  </Link>
                </div>
              )}

              {/* Navigation Links */}
              <div className="hidden md:block">
                <div className="ml-2 flex items-center space-x-4">
                  {navigation
                    .filter(item => {
                      if (item.requiresClient) {
                        return isClient;
                      }
                      if (item.requiresAdmin) {
                        return userRoleLevel >= 100 || isSuperuser;
                      }
                      if (item.requiresManager) {
                        return userRoleLevel >= 90;
                      }
                      if (item.requiresSupervisor) {
                        return userRoleLevel >= 80; // Supervisor level is 80
                      }
                      if (item.requiresTechnician) {
                        return userRoleLevel >= 50; // Technician level is 50
                      }
                      return true;
                    })
                    .map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        className={({ isActive }) => (
                          `${
                            isActive
                              ? 'bg-gray-900 text-white dark:bg-gray-900 dark:text-white'
                              : 'text-gray-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-black dark:hover:text-white'
                          } px-3 py-2 rounded-md text-sm font-medium`
                        )}
                      >
                        {item.name}
                      </NavLink>
                    ))}
                </div>
              </div>
            </div>

            {/* Right side buttons */}
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="p-2 rounded-full text-gray-900 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
                  >
                    {getUserInitials() ? (
                      <div className="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-sm font-medium">
                        {getUserInitials()}
                      </div>
                    ) : (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </button>
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50">
                      {userMenuOptions
                        .filter(option => {
                          if (option.name === "Access Management") {
                            return isSuperuser;
                          }
                          if (option.name === "Role Management" || option.name === "User Management") {
                            return isSuperuser || user?.roles?.some(role =>
                              role.permissions?.includes('manage_roles') || role.permissions?.includes('manage_users')
                            );
                          }
                          return true;
                        })
                        .map((option) => (
                          <div key={option.name}>
                            {option.href ? (
                              <Link
                                to={option.href}
                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                onClick={() => setIsProfileMenuOpen(false)}
                              >
                                <div className="flex items-center">
                                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.icon} />
                                  </svg>
                                  {option.name}
                                </div>
                              </Link>
                            ) : (
                              <button
                                onClick={() => {
                                  if (option.action === 'logout') {
                                    handleLogout();
                                  }
                                  setIsProfileMenuOpen(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <div className="flex items-center">
                                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.icon} />
                                  </svg>
                                  {option.name}
                                </div>
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation
                .filter(item => {
                  if (item.requiresClient) {
                    return isClient;
                  }
                  if (item.requiresAdmin) {
                    return userRoleLevel >= 100 || isSuperuser;
                  }
                  if (item.requiresManager) {
                    return userRoleLevel >= 90;
                  }
                  if (item.requiresSupervisor) {
                    return userRoleLevel >= 80;
                  }
                  if (item.requiresTechnician) {
                    return userRoleLevel >= 50;
                  }
                  return true;
                })
                .map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => (
                      `${
                        isActive
                          ? 'bg-gray-900 text-white dark:bg-gray-900 dark:text-white'
                          : 'text-gray-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      } block px-3 py-2 rounded-md text-base font-medium`
                    )}
                  >
                    {item.name}
                  </NavLink>
                ))}
            </div>
          </div>
        )}
      </nav>

      <Login
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />
    </>
  );
}
