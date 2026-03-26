import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import ReportDetails from './ReportDetails';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ reportId: '9' }),
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

describe('ReportDetails', () => {
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

    apiGet.mockImplementation((url) => {
      if (url === '/api/v1/reports/9') {
        return Promise.resolve({
          data: {
            id: 9,
            project_id: 123,
            report_kind: 'area',
            report_date: '2026-02-25',
            formatted_address: '123 Main St, Testville, TX 00000',
            generated_by_name: 'Uploader Name',
            technician_name: 'Tech Name',
          },
        });
      }
      if (url === '/api/v1/reports/9/download') {
        return Promise.resolve({ data: new Uint8Array([1, 2, 3]) });
      }
      return Promise.reject(new Error(`Unhandled GET ${url}`));
    });
  });

  it('renders the report details and iframe preview', async () => {
    render(<ReportDetails />);

    expect(await screen.findByRole('heading', { name: /123 main st/i })).toBeInTheDocument();
    expect(await screen.findByText(/uploaded by/i)).toBeInTheDocument();

    // iframe should be present after PDF loads
    const iframe = await screen.findByTitle('Report PDF');
    expect(iframe).toBeInTheDocument();
  });
});
