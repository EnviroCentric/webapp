import './index.css';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ServiceInfo from './pages/ServiceInfo';
import Info from './pages/Info';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ProfileEdit from './pages/ProfileEdit';
import ProfilePassword from './pages/ProfilePassword';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import Projects from './pages/Projects';
import ProjectDashboard from './pages/ProjectDashboard';
import ProjectReports from './pages/ProjectReports';
import SampleCollection from './pages/SampleCollection';
import CompanyManagement from './pages/CompanyManagement';
import CompanyDetails from './pages/CompanyDetails';
import CompanyReports from './pages/CompanyReports';
import CompanyDashboard from './pages/CompanyDashboard';
import ReportUpload from './pages/ReportUpload';
import ReportDetails from './pages/ReportDetails';
import AdminPortal from './pages/AdminPortal';

import { RolesProvider } from './context/RolesContext';
import { PermissionsProvider } from './context/PermissionsContext';

function App() {
  return (
    <AuthProvider>
      <RolesProvider>
        <PermissionsProvider>
          <ThemeProvider>
            <div className="min-h-screen bg-gray-300 dark:bg-gray-900">
              <Navbar />
              <main className="pt-16 pb-6 min-h-[calc(100vh-4rem)] bg-gray-300 dark:bg-gray-900">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/services" element={<ServiceInfo />} />
                  <Route path="/info" element={<Info />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/projects"
                    element={
                      <ProtectedRoute>
                        <Projects />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/projects/:projectId"
                    element={
                      <ProtectedRoute>
                        <ProjectDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/projects/:projectId/reports"
                    element={
                      <ProtectedRoute>
                        <ProjectReports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/projects/:projectId/addresses/:addressId/collect-samples"
                    element={
                      <ProtectedRoute>
                        <SampleCollection />
                      </ProtectedRoute>
                    }
                  />
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
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Login />} />
                  <Route
                    path="/user-management"
                    element={
                      <ProtectedRoute>
                        <UserManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/companies"
                    element={
                      <ProtectedRoute>
                        <CompanyManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/companies/:companyId"
                    element={
                      <ProtectedRoute>
                        <CompanyDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/companies/:companyId/reports"
                    element={
                      <ProtectedRoute>
                        <CompanyReports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/company/me"
                    element={
                      <ProtectedRoute>
                        <CompanyDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/upload"
                    element={
                      <ProtectedRoute>
                        <ReportUpload />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/:reportId"
                    element={
                      <ProtectedRoute>
                        <ReportDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute>
                        <AdminPortal />
                      </ProtectedRoute>
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
