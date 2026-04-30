import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import CompanyDashboard from './CompanyDashboard';

const mockNavigate = vi.fn();
const apiGet = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      company_id: 77,
      is_superuser: false,
      roles: [{ name: 'client', level: 10 }],
    },
  }),
}));

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGet(...args),
  },
}));

describe('CompanyDashboard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    apiGet.mockReset();

    apiGet.mockImplementation((url) => {
      if (url === '/api/v1/companies/') {
        return Promise.resolve({
          data: [{ id: 77, name: 'Acme', created_at: '2026-01-01T00:00:00Z' }],
        });
      }
      if (url === '/api/v1/companies/77/projects') {
        return Promise.resolve({
          data: {
            projects: [
              {
                id: 123,
                name: 'Project 123',
                status: 'open',
                created_at: '2026-02-01T00:00:00Z',
                visit_count: 9,
                sample_count: 42,
              },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unhandled GET ${url}`));
    });
  });

  it('shows client projects without site visit or sample counters', async () => {
    render(<CompanyDashboard />);

    expect(await screen.findByText('Project 123')).toBeInTheDocument();
    expect(screen.queryByText(/site visits/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/samples/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view reports/i })).toBeInTheDocument();
  });
});
