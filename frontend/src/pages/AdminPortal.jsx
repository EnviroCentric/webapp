import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddressInput from '../components/AddressInput';

function titleCaseWords(input) {
  return String(input || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatRoleName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';

  // Normalize separators + split camelCase/PascalCase.
  const spaced = raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  return titleCaseWords(spaced);
}

async function copyToClipboard(text) {
  const value = String(text ?? '');

  // Preferred modern API (requires secure context + permissions).
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  // Fallback for environments where clipboard API is unavailable.
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const ok = document.execCommand && document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!ok) {
    throw new Error('Copy failed');
  }
}

function generateTempPassword() {
  // Meets: 8+ chars, upper, lower, digit, special.
  const specials = '!@#$%^&*';
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (s) => s[rand(s.length)];

  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';

  const core = [pick(upper), pick(lower), pick(digits), pick(specials)];
  while (core.length < 12) core.push(pick(upper + lower + digits));

  // Shuffle
  for (let i = core.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [core[i], core[j]] = [core[j], core[i]];
  }

  return core.join('');
}

export default function AdminPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const roleLevel = Math.max(...((user?.roles || []).map(r => r.level || 0)), 0);
  const isAdmin = !!(user?.is_superuser || roleLevel >= 100);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState([]);

  // Tabs
  const [activeTab, setActiveTab] = useState('company');

  // --- Create company ---
  const [companyData, setCompanyData] = useState({
    name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
    formatted_address: '',
    google_place_id: '',
    latitude: null,
    longitude: null,
  });
  const [companySuccess, setCompanySuccess] = useState('');

  // --- Create project ---
  const [projectCompanyId, setProjectCompanyId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectSuccess, setProjectSuccess] = useState('');

  // --- Create client ---
  const [clientCompanyId, setClientCompanyId] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [clientSuccess, setClientSuccess] = useState(null);
  const [clientCopyStatus, setClientCopyStatus] = useState('');

  // --- Create employee ---
  const [empEmail, setEmpEmail] = useState('');
  const [empFirstName, setEmpFirstName] = useState('');
  const [empLastName, setEmpLastName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empPasswordConfirm, setEmpPasswordConfirm] = useState('');
  const [empRoleIds, setEmpRoleIds] = useState([]);
  const [empAssignCompanyId, setEmpAssignCompanyId] = useState('');
  const [empCompanyProjects, setEmpCompanyProjects] = useState([]);
  const [empProjectIds, setEmpProjectIds] = useState([]);
  const [empSuccess, setEmpSuccess] = useState(null);
  const [empWarning, setEmpWarning] = useState('');

  const employeeAssignableRoles = useMemo(() => {
    // Employees generally shouldn't get client role; hide it.
    return (roles || []).filter(r => (r.name || '').toLowerCase() !== 'client');
  }, [roles]);

  useEffect(() => {
    const run = async () => {
      if (!isAdmin) {
        navigate('/dashboard', { replace: true });
        return;
      }

      try {
        const [companiesResp, rolesResp] = await Promise.all([
          api.get('/api/v1/companies/'),
          api.get('/api/v1/roles/'),
        ]);

        setCompanies(companiesResp.data || []);
        setRoles(rolesResp.data || []);
      } catch (err) {
        console.error('AdminPortal load failed:', err);
        setError('Failed to load admin portal data');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [isAdmin, navigate]);

  useEffect(() => {
    const run = async () => {
      if (!empAssignCompanyId) {
        setEmpCompanyProjects([]);
        setEmpProjectIds([]);
        return;
      }

      try {
        const resp = await api.get(`/api/v1/companies/${empAssignCompanyId}/projects`);
        setEmpCompanyProjects(resp.data.projects || []);
        setEmpProjectIds([]);
      } catch (err) {
        console.error('Failed to load projects for assignment company:', err);
        setEmpCompanyProjects([]);
      }
    };

    run();
  }, [empAssignCompanyId]);

  const onCompanyAddressChange = (addressData) => {
    const { name, ...addressFields } = addressData || {};
    setCompanyData(prev => ({ ...prev, ...addressFields }));
  };

  const refreshCompanies = async () => {
    const resp = await api.get('/api/v1/companies/');
    setCompanies(resp.data || []);
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setError('');
    setCompanySuccess('');

    try {
      await api.post('/api/v1/companies/', {
        name: companyData.name,
        address_line1: companyData.address_line1,
        address_line2: companyData.address_line2,
        city: companyData.city,
        state: companyData.state,
        zip: companyData.zip,
      });

      await refreshCompanies();
      setCompanySuccess('Company created.');
      setCompanyData({
        name: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        zip: '',
        formatted_address: '',
        google_place_id: '',
        latitude: null,
        longitude: null,
      });
    } catch (err) {
      console.error('Create company failed:', err);
      setError(err?.response?.data?.detail || 'Failed to create company');
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError('');
    setProjectSuccess('');

    if (!projectCompanyId) {
      setError('Select a company for the project.');
      return;
    }

    try {
      await api.post('/api/v1/projects/', {
        company_id: Number(projectCompanyId),
        name: projectName,
      });

      setProjectSuccess('Project created.');
      setProjectName('');
      setProjectCompanyId('');
    } catch (err) {
      console.error('Create project failed:', err);
      setError(err?.response?.data?.detail || 'Failed to create project');
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setError('');
    setClientSuccess(null);
    setClientCopyStatus('');

    if (!clientCompanyId) {
      setError('Select a company for the client.');
      return;
    }

    try {
      const resp = await api.post('/api/v1/users/client', {
        company_id: Number(clientCompanyId),
        email: clientEmail,
        first_name: clientFirstName,
        last_name: clientLastName,
        phone: clientPhone || null,
        code: clientCode,
      });

      setClientSuccess(resp.data);
      setClientEmail('');
      setClientFirstName('');
      setClientLastName('');
      setClientPhone('');
      setClientCode('');
      setClientCompanyId('');
    } catch (err) {
      console.error('Create client failed:', err);
      setError(err?.response?.data?.detail || 'Failed to create client');
    }
  };

  const toggleRole = (roleId, checked) => {
    setEmpRoleIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(roleId);
      else set.delete(roleId);
      return Array.from(set);
    });
  };

  const toggleProject = (projectId, checked) => {
    setEmpProjectIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(projectId);
      else set.delete(projectId);
      return Array.from(set);
    });
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setError('');
    setEmpWarning('');
    setEmpSuccess(null);

    if (!empEmail || !empFirstName || !empLastName) {
      setError('Employee email, first name, and last name are required.');
      return;
    }

    if (!empPassword) {
      setError('Employee password is required.');
      return;
    }

    if (empPassword !== empPasswordConfirm) {
      setError('Employee passwords do not match.');
      return;
    }

    if (empRoleIds.length === 0) {
      setError('Select at least one role for the employee.');
      return;
    }

    try {
      // 1) Create user (employees should have company_id = null)
      const userResp = await api.post('/api/v1/users', {
        email: empEmail,
        password: empPassword,
        first_name: empFirstName,
        last_name: empLastName,
        phone: empPhone || null,
        company_id: null,
      });

      const createdUser = userResp.data;

      // 2) Assign roles (replaces roles)
      await api.put(`/api/v1/users/${createdUser.id}/roles`, { role_ids: empRoleIds });

      // 3) Optionally assign to projects (non-fatal if it fails)
      const assignmentFailures = [];
      for (const pid of empProjectIds) {
        try {
          await api.post(`/api/v1/projects/${pid}/technicians`, { user_id: createdUser.id });
        } catch (assignErr) {
          assignmentFailures.push(assignErr?.response?.data?.detail || `Failed to assign to project ${pid}`);
        }
      }

      setEmpSuccess({
        user: createdUser,
        assigned_role_ids: empRoleIds,
        assigned_project_ids: empProjectIds,
      });

      if (assignmentFailures.length > 0) {
        setEmpWarning(`Employee created, but project assignment failed: ${assignmentFailures.join('; ')}`);
      }

      setEmpEmail('');
      setEmpFirstName('');
      setEmpLastName('');
      setEmpPhone('');
      setEmpPassword('');
      setEmpPasswordConfirm('');
      setEmpRoleIds([]);
      setEmpAssignCompanyId('');
      setEmpCompanyProjects([]);
      setEmpProjectIds([]);
    } catch (err) {
      console.error('Create employee failed:', err);
      setError(err?.response?.data?.detail || 'Failed to create employee');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Portal</h1>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-2 overflow-x-auto" role="tablist" aria-label="Admin categories">
          {[
            { id: 'company', label: 'Company' },
            { id: 'project', label: 'Project' },
            { id: 'client', label: 'Client' },
            { id: 'employee', label: 'Employee' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              aria-controls={`admin-tabpanel-${t.id}`}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {/* Create Company */}
        {activeTab === 'company' && (
          <div id="admin-tabpanel-company" role="tabpanel" aria-label="Company">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create Company</h2>
              {companySuccess && (
                <div className="mb-3 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                  {companySuccess}
                </div>
              )}
              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company name</label>
                  <input
                    value={companyData.name}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <AddressInput
                  value={companyData}
                  onChange={onCompanyAddressChange}
                  required={false}
                  showManualEntry={false}
                  showLocationName={false}
                />

                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
                    Create Company
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Project */}
        {activeTab === 'project' && (
          <div id="admin-tabpanel-project" role="tabpanel" aria-label="Project">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create Project</h2>
              {projectSuccess && (
                <div className="mb-3 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                  {projectSuccess}
                </div>
              )}
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company</label>
                  <select
                    value={projectCompanyId}
                    onChange={(e) => setProjectCompanyId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select a company...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project name</label>
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Client */}
        {activeTab === 'client' && (
          <div id="admin-tabpanel-client" role="tabpanel" aria-label="Client">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create Client Account</h2>
              {clientSuccess && (
                <div className="mb-3 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                  <div className="font-medium">Client created.</div>
                  <div className="text-sm">Default password: <span className="font-mono">{clientSuccess.default_password}</span></div>
                  <button
                    type="button"
                    className="mt-2 px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                    onClick={async () => {
                      try {
                        await copyToClipboard(clientSuccess.default_password);
                        setClientCopyStatus('Copied!');
                        window.setTimeout(() => setClientCopyStatus(''), 2000);
                      } catch (copyErr) {
                        console.error('Copy password failed:', copyErr);
                        setClientCopyStatus('Copy failed');
                        window.setTimeout(() => setClientCopyStatus(''), 2500);
                      }
                    }}
                  >
                    Copy password
                  </button>
                  {clientCopyStatus && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">{clientCopyStatus}</div>
                  )}
                </div>
              )}
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company</label>
                  <select
                    value={clientCompanyId}
                    onChange={(e) => setClientCompanyId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select a company...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First name</label>
                    <input value={clientFirstName} onChange={(e) => setClientFirstName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last name</label>
                    <input value={clientLastName} onChange={(e) => setClientLastName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone (optional)</label>
                    <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">4-digit code</label>
                    <input value={clientCode} onChange={(e) => setClientCode(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="1234" required />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
                    Create Client
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Employee */}
        {activeTab === 'employee' && (
          <div id="admin-tabpanel-employee" role="tabpanel" aria-label="Employee">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create Employee Account</h2>
              {empSuccess && (
                <div className="mb-3 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                  Employee created: <span className="font-mono">{empSuccess.user.email}</span>
                </div>
              )}
              {empWarning && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded">
                  {empWarning}
                </div>
              )}
              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First name</label>
                    <input value={empFirstName} onChange={(e) => setEmpFirstName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last name</label>
                    <input value={empLastName} onChange={(e) => setEmpLastName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input type="email" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone (optional)</label>
                  <input value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                    <input type="text" value={empPassword} onChange={(e) => setEmpPassword(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                    <button
                      type="button"
                      className="mt-2 px-3 py-1 text-xs font-medium rounded bg-gray-700 text-white hover:bg-gray-800"
                      onClick={() => {
                        const pw = generateTempPassword();
                        setEmpPassword(pw);
                        setEmpPasswordConfirm(pw);
                      }}
                    >
                      Generate temp password
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm password</label>
                    <input type="text" value={empPasswordConfirm} onChange={(e) => setEmpPasswordConfirm(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Roles</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {employeeAssignableRoles.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={empRoleIds.includes(r.id)}
                          onChange={(e) => toggleRole(r.id, e.target.checked)}
                        />
                        {formatRoleName(r.name)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Optional project assignment</div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company (for project list)</label>
                    <select
                      value={empAssignCompanyId}
                      onChange={(e) => setEmpAssignCompanyId(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">No project assignment</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {empAssignCompanyId && (
                    <div className="mt-3 grid grid-cols-1 gap-2 max-h-40 overflow-auto border border-gray-200 dark:border-gray-700 rounded p-3">
                      {empCompanyProjects.length === 0 ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400">No projects for this company.</div>
                      ) : (
                        empCompanyProjects.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={empProjectIds.includes(p.id)}
                              onChange={(e) => toggleProject(p.id, e.target.checked)}
                            />
                            {p.name}
                          </label>
                        ))
                      )}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Note: project assignment is intended for technician-type employees; if the selected roles don't allow assignment, the employee will still be created.
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
                    Create Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
