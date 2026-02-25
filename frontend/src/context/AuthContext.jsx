import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getAuthToken, 
  isTokenExpired, 
  login as loginService, 
  register as registerService, 
  getCurrentUser, 
  logout as logoutService
} from '../services/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(getAuthToken());
  const navigate = useNavigate();
  const fetchInProgress = useRef(false);
  const lastFetchTime = useRef(0);
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

  const getPostLoginRoute = (userData) => {
    if (!userData) return '/dashboard';

    if (userData.must_change_password) return '/profile/password';

    const roles = userData.roles || [];
    const roleLevel = Math.max(...roles.map(r => r.level || 0), 0);
    const hasClientRole = roles.some(r => (r.name || '').toLowerCase() === 'client');

    // Client = has client role + company_id set + not admin.
    if (hasClientRole && userData.company_id && roleLevel < 100) {
      return '/company/me';
    }

    return '/dashboard';
  };

  const fetchUserData = async (force = false) => {
    const now = Date.now();
    if (!force && user && now - lastFetchTime.current < CACHE_DURATION) {
      return user; // Use cached data if it's still valid
    }

    if (fetchInProgress.current) {
      return user; // Prevent concurrent fetches
    }

    try {
      fetchInProgress.current = true;
      const userData = await getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
      lastFetchTime.current = now;
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      logout();
      return null;
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  };

  useEffect(() => {
    const currentToken = getAuthToken();
    if (currentToken && !isTokenExpired(currentToken)) {
      setToken(currentToken);
      fetchUserData();
    } else {
      setIsAuthenticated(false);
      setLoading(false);
      if (currentToken) {
        logout();
      }
    }
  }, []);

  const login = async (email, password) => {
    const response = await loginService(email, password);
    setToken(getAuthToken());
    const userData = await fetchUserData(true); // Force fetch on login
    return {
      ...response,
      user: userData,
      destination: getPostLoginRoute(userData),
    };
  };

  const register = async (userData) => {
    const response = await registerService(userData);
    setToken(getAuthToken());
    const createdUser = await fetchUserData(true); // Force fetch after registration
    return {
      ...response,
      user: createdUser,
      destination: getPostLoginRoute(createdUser),
    };
  };

  const logout = () => {
    logoutService();
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    navigate('/');
  };

  const refreshUserData = async () => {
    return await fetchUserData(true); // Force refresh
  };

  const value = {
    user,
    setUser,
    isAuthenticated,
    loading,
    token,
    login,
    register,
    logout,
    refreshUserData,
    getPostLoginRoute,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 