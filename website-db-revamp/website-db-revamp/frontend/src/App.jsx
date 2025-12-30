import './index.css';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ProfileEdit from './pages/ProfileEdit';
import ProfilePassword from './pages/ProfilePassword';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleBasedRoute, { RequireTechnician, RequireSupervisor, RequireAdmin, RequireClient } from './routes/RoleBasedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import UserManagement from './pages/UserManagement';
import Projects from './pages/Projects';
import ProjectDashboard from './pages/ProjectDashboard';
import SampleCollection from './pages/SampleCollection';
import ServiceInfo from './pages/ServiceInfo';
import CompanyManagement from './pages/CompanyManagement';
import CompanyDetails from './pages/CompanyDetails';
import CompanyDashboard from './pages/CompanyDashboard';
import CameraTest from './components/CameraTest';
import MobileCameraTest from './components/MobileCameraTest';

import { RolesProvider } from './context/RolesContext';
import { PermissionsProvider } from './context/PermissionsContext';

function App() {
  return (
    <AuthProvider>
      <RolesProvider>
        <PermissionsProvider>
          <ThemeProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
              <Navbar />
              <main className="pt-16 pb-6 min-h-[calc(100vh-4rem)] bg-white dark:bg-gray-900">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/services" element={<ServiceInfo />} />
                  {/* Dashboard - Requires Technician level (50) or higher */}
                  <Route
                    path="/dashboard"
                    element={
                      <RequireTechnician showForbidden={true}>
                        <Dashboard />
                      </RequireTechnician>
                    }
                  />
                  
                  {/* Projects - Requires Supervisor level (80) or higher */}
                  <Route
                    path="/projects"
                    element={
                      <RequireSupervisor showForbidden={true}>
                        <Projects />
                      </RequireSupervisor>
                    }
                  />
                  <Route
                    path="/projects/:projectId"
                    element={
                      <RequireTechnician showForbidden={true}>
                        <ProjectDashboard />
                      </RequireTechnician>
                    }
                  />
                  
                  {/* Sample Collection - Requires Technician level (50) or higher */}
                  <Route
                    path="/projects/:projectId/collect-samples"
                    element={
                      <RequireTechnician showForbidden={true}>
                        <SampleCollection />
                      </RequireTechnician>
                    }
                  />
                  <Route
                    path="/projects/:projectId/addresses/:addressId/collect-samples"
                    element={
                      <RequireTechnician showForbidden={true}>
                        <SampleCollection />
                      </RequireTechnician>
                    }
                  />
                  
                  {/* Profile pages - Any authenticated user */}
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/edit"
                    element={
                      <ProtectedRoute>
                        <ProfileEdit />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/password"
                    element={
                      <ProtectedRoute>
                        <ProfilePassword />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  
                  {/* Debug routes */}
                  <Route path="/camera-test" element={<CameraTest />} />
                  <Route path="/mobile-camera-test" element={<MobileCameraTest />} />
                  
                  {/* User Management - Requires Supervisor level (80) or higher */}
                  <Route
                    path="/user-management"
                    element={
                      <RoleBasedRoute minLevel={80} showForbidden={true}>
                        <UserManagement />
                      </RoleBasedRoute>
                    }
                  />
                  
                  {/* Company Management - Requires Admin level (100) */}
                  <Route
                    path="/companies"
                    element={
                      <RequireAdmin showForbidden={true}>
                        <CompanyManagement />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/companies/:companyId"
                    element={
                      <RequireAdmin showForbidden={true}>
                        <CompanyDetails />
                      </RequireAdmin>
                    }
                  />
                  
                  {/* Client Company Dashboard - Requires Client role with company assignment */}
                  <Route
                    path="/company/me"
                    element={
                      <RequireClient showForbidden={true}>
                        <CompanyDashboard />
                      </RequireClient>
                    }
                  />
                </Routes>
              </main>
            </div>
          </ThemeProvider>
        </PermissionsProvider>
      </RolesProvider>
    </AuthProvider>
  );
}

export default App;
