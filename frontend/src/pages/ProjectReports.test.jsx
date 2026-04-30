import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProjectReports from './ProjectReports';

const mockNavigate = vi.fn();
let mockUser;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ projectId: '123' }),
  };
});

vi.mock('../context/AuthContext', () => {
  return {
    useAuth: () => ({
      user: mockUser,
    }),
  };
});

const apiGet = vi.fn();

vi.mock('../services/api', () => {
  return {
    default: {
      get: (...args) => apiGet(...args),
    },
  };
});

describe('ProjectReports', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    mockNavigate.mockReset();
    apiGet.mockReset();
    mockUser = {
      roles: [{ name: 'field_tech', level: 50 }],
      is_superuser: false,
    };

    if (!window.URL.createObjectURL) {
      Object.defineProperty(window.URL, 'createObjectURL', {
        value: vi.fn(() => 'blob:mock'),
        configurable: true,
        writable: true,
      });
    } else {
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock');
    }

    if (!window.URL.revokeObjectURL) {
      Object.defineProperty(window.URL, 'revokeObjectURL', {
        value: vi.fn(() => undefined),
        configurable: true,
        writable: true,
      });
    } else {
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => undefined);
    }

    apiGet.mockImplementation((url, config) => {
      if (url === '/api/v1/projects/123') return Promise.resolve({ data: { id: 123, name: 'Proj 123' } });
      if (url === '/api/v1/reports/' && config?.params?.project_id === '123') {
        return Promise.resolve({
          data: [
            {
              id: 1,
              report_name: 'R1',
              formatted_address: '123 Main St, Testville, TX 00000',
              is_final: true,
              client_visible: true,
              report_kind: 'area',
              report_date: '2026-02-24',
            },
          ],
        });
      }
      if (url === '/api/v1/reports/client/projects/123/reports') {
        return Promise.resolve({
          data: [
            {
              id: 1,
              report_name: 'R1',
              formatted_address: '123 Main St, Testville, TX 00000',
              is_final: true,
              client_visible: true,
              report_kind: 'area',
              report_date: '2026-02-24',
            },
          ],
        });
      }
      if (url === '/api/v1/reports/1/download') return Promise.resolve({ data: new Uint8Array([1, 2, 3]) });
      return Promise.reject(new Error(`Unhandled GET ${url}`));
    });
  });

  it('loads and renders reports, and triggers download', async () => {
    const user = userEvent.setup();

    render(<ProjectReports />);

    expect(await screen.findByText('Project Reports')).toBeInTheDocument();
    expect((await screen.findAllByText(/123 Main St/)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /download pdf/i }));
    expect(apiGet).toHaveBeenCalledWith('/api/v1/reports/1/download', { responseType: 'blob' });
  });

  it('links manager uploads to the current project', async () => {
    const user = userEvent.setup();
    mockUser = {
      roles: [{ name: 'manager', level: 90 }],
      is_superuser: false,
    };

    render(<ProjectReports />);

    await screen.findByText('Project Reports');
    await user.click(screen.getByRole('button', { name: /upload report/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/reports/upload?projectId=123');
  });

  it('uses the client project reports endpoint and hides upload controls for clients', async () => {
    mockUser = {
      roles: [{ name: 'client', level: 10 }],
      company_id: 77,
      is_superuser: false,
    };

    render(<ProjectReports />);

    expect(await screen.findByText('Project Reports')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/api/v1/reports/client/projects/123/reports');
    expect(screen.queryByRole('button', { name: /upload report/i })).not.toBeInTheDocument();
  });
});
