import api from './api';
import jwtDecode from 'jwt-decode';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Configure axios defaults
api.defaults.baseURL = API_URL;

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await api.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken
        });

        const { access_token, refresh_token } = response.data;
        setAuthToken(access_token);
        localStorage.setItem('refreshToken', refresh_token);

        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Token Management Functions
export const isTokenExpired = (token) => {
  try {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000 < Date.now();
  } catch (error) {
    return true;
  }
};

export const getTokenData = (token) => {
  try {
    return jwtDecode(token);
  } catch (error) {
    return null;
  }
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const getAuthToken = () => {
  return localStorage.getItem('token');
};

// API Service Functions
export const register = async (userData) => {
  try {
    const response = await api.post('/api/v1/auth/register', {
      ...userData,
      password_confirm: userData.password
    });
    const { access_token, refresh_token } = response.data;
    setAuthToken(access_token);
    localStorage.setItem('refreshToken', refresh_token);
    return response.data;
  } catch (error) {
    throw error.response?.data || { detail: 'An error occurred during registration' };
  }
};

// Test login function
export const testLogin = async (email, password) => {
  try {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    console.log('Sending test login request to:', `${API_URL}/test-login`);
    console.log('Request data:', {
      username: email,
      password: '***' // Don't log actual password
    });

    const response = await api.post('/test-login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    console.log('Test login response:', response.data);
    return response.data;
  } catch (error) {
    console.log('Test login error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
      message: error.message,
      code: error.code
    });
    throw error;
  }
};

export const login = async (email, password) => {
  try {
    console.log('🚀 === LOGIN FLOW STARTED ===');
    console.log('📧 Email:', email);
    console.log('🔗 User Agent:', navigator.userAgent);
    console.log('🌐 Current URL:', window.location.href);
    console.log('💾 LocalStorage available:', typeof(Storage) !== "undefined");
    
    // Create form data as plain string for maximum compatibility
    const formDataString = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    console.log('📝 Form data string:', formDataString);
    
    // Environment and URL checks
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    console.log('🏠 API base URL:', apiUrl);
    console.log('🎯 Full login URL:', `${apiUrl}/api/v1/auth/login`);
    console.log('⚙️ Axios base URL:', api.defaults.baseURL);
    
    // Pre-request checks
    console.log('🔍 Pre-request checks:');
    console.log('  - Network online:', navigator.onLine);
    console.log('  - HTTPS context:', window.location.protocol === 'https:');
    
    console.log('📤 Sending login request...');
    
    // Use axios with mobile-friendly configuration
    const response = await api.post('/api/v1/auth/login', formDataString, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': navigator.userAgent,
        'Cache-Control': 'no-cache'
      },
      timeout: 30000, // 30 second timeout
      maxRedirects: 0 // Prevent redirects
    });
    
    console.log('✅ Login response received!');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response headers:', response.headers);
    console.log('📦 Response data:', response.data);
    console.log('🔍 Response data type:', typeof response.data);
    
    // Validate response structure
    if (!response.data) {
      console.log('❌ No data in response');
      throw new Error('No data received from server');
    }
    
    const { access_token, refresh_token } = response.data;
    console.log('🔑 Access token present:', !!access_token);
    console.log('🔄 Refresh token present:', !!refresh_token);
    
    if (access_token && refresh_token) {
      console.log('💾 Storing tokens...');
      setAuthToken(access_token);
      localStorage.setItem('refreshToken', refresh_token);
      console.log('✅ Tokens stored successfully');
      console.log('🎉 LOGIN FLOW COMPLETED SUCCESSFULLY');
      return response.data;
    } else {
      console.log('❌ Missing tokens in response:', response.data);
      throw new Error('Invalid response: missing tokens');
    }
  } catch (error) {
    console.log('❌ Login error caught:', error);
    
    if (error.code === 'ERR_NETWORK') {
      throw { detail: 'Network error: Unable to reach the server. Please check your connection.' };
    }
    if (error.response?.data?.detail) {
      if (Array.isArray(error.response.data.detail)) {
        throw { detail: error.response.data.detail[0].msg };
      } else if (typeof error.response.data.detail === 'object') {
        throw { detail: error.response.data.detail.msg };
      } else {
        throw { detail: error.response.data.detail };
      }
    }
    
    // Handle our custom error messages
    if (error.message) {
      throw { detail: error.message };
    }
    
    throw { detail: 'An error occurred during login' };
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/api/v1/auth/me');
    return response.data;
  } catch (error) {
    throw error.response?.data || { detail: 'An error occurred while fetching user data' };
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
};

// Simple health check for debugging network connectivity
export const testConnection = async () => {
  try {
    console.log('Testing connection to:', API_URL);
    const response = await api.get('/');
    console.log('✅ Connection test successful:', response.status, response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.log('❌ Connection test failed:', error);
    return { success: false, error: error.message };
  }
};
