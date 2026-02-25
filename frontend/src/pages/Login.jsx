import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

export default function Login({ isOpen, onClose, successMessage }) {
  const [formData, setFormData] = useState(() => {
    const savedData = localStorage.getItem('loginFormData');
    return savedData ? JSON.parse(savedData) : {
      email: '',
      password: '',
    };
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailUnregistered, setIsEmailUnregistered] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isModal = typeof isOpen === 'boolean';
  const from = location.state?.from?.pathname;

  // Clear form data when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        email: '',
        password: '',
      });
      setError('');
      setIsEmailUnregistered(false);
      setShowPassword(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      localStorage.setItem('loginFormData', JSON.stringify(formData));
    }
  }, [formData, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Reset error states when email changes
    if (name === 'email') {
      setError('');
      setIsEmailUnregistered(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      localStorage.removeItem('loginFormData');

      if (onClose) {
        onClose();
      }

      // Always honor forced password-change/client landing; for non-clients, allow returning to the original route.
      const userData = result?.user;
      const roles = userData?.roles || [];
      const roleLevel = Math.max(...roles.map(r => r.level || 0), 0);
      const hasClientRole = roles.some(r => (r.name || '').toLowerCase() === 'client');
      const isClient = !!(hasClientRole && userData?.company_id && roleLevel < 100);

      const destination = result?.destination || '/dashboard';
      const target = isClient ? destination : (from || destination);
      navigate(target, { replace: true });
    } catch (error) {
      if (error.detail === "Email not registered. Please create an account first.") {
        setError(error.detail);
        setIsEmailUnregistered(true);
      } else {
        setError(error.detail || 'An error occurred during login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className="w-full space-y-8">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Sign in to your account
        </h2>
      </div>
        {successMessage && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
            <div className="text-sm text-green-700 dark:text-green-400">
              {successMessage}
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                  {error}
                </h3>
                {isEmailUnregistered && (
                  <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                    <p>Please contact your administrator to request access.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                  isEmailUnregistered ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'
                } placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                placeholder="Email address"
                disabled={isEmailUnregistered}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pr-10"
                placeholder="Password"
                disabled={isEmailUnregistered}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                className="absolute inset-y-0 right-0 pr-3 flex items-center z-20"
              >
                {showPassword ? (
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || isEmailUnregistered}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                isEmailUnregistered ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              ) : null}
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Accounts are provisioned by an administrator. If you need access, contact your admin.
            </p>
          </div>
        </form>
      </div>
  );

  if (isModal) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        {content}
      </Modal>
    );
  }

  // Page mode (/login route)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        {content}
      </div>
    </div>
  );
} 