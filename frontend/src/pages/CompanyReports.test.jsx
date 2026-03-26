import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import CompanyReports from './CompanyReports';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ companyId: '77' }),
  };
});

vi.mock('../context/AuthContext', () => {
  return {
    useAuth: () => ({
      user: {
        roles: [{ name: 'supervisor', level: 80 }],
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

describe('CompanyReports', () => {
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
      if (url === '/api/v1/companies/77') return Promise.resolve({ data: { id: 77, name: 'acme' } });
      if (url === '/api/v1/reports/' && config?.params?.company_id === '77') {
        return Promise.resolve({
          data: [
            {
              id: 10,
              report_name: 'CReport',
              formatted_address: '123 Main St, Testville, TX 00000',
              project_id: 123,
              project_name: 'Proj 123',
              is_final: true,
              client_visible: true,
              report_kind: 'area',
              report_date: '2026-02-24',
            },
          ],
        });
      }
      return Promise.reject(new Error(`Unhandled GET ${url}`));
    });
  });

  it('loads and renders company reports', async () => {
    render(<CompanyReports />);

    expect(await screen.findByText('Company Reports')).toBeInTheDocument();
    expect(await screen.findByText('123 Main St 02/24/26')).toBeInTheDocument();
    expect(screen.getByText(/proj 123/i)).toBeInTheDocument();
  });
});
