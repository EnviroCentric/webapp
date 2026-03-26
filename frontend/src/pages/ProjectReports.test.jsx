import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProjectReports from './ProjectReports';

const mockNavigate = vi.fn();

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
      user: {
        roles: [{ name: 'field_tech', level: 50 }],
        is_superuser: false,
      },
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
      if (url === '/api/v1/reports/1/download') return Promise.resolve({ data: new Uint8Array([1, 2, 3]) });
      return Promise.reject(new Error(`Unhandled GET ${url}`));
    });
  });

  it('loads and renders reports, and triggers download', async () => {
    const user = userEvent.setup();

    render(<ProjectReports />);

    expect(await screen.findByText('Project Reports')).toBeInTheDocument();
    expect(await screen.findByText('123 Main St 02/24/26')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /download pdf/i }));
    expect(apiGet).toHaveBeenCalledWith('/api/v1/reports/1/download', { responseType: 'blob' });
  });
});
