import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReportUpload from './ReportUpload';

const mockNavigate = vi.fn();
const apiGet = vi.fn();
const apiPost = vi.fn();
let mockAddressData;
const mockManagerUser = {
  roles: [{ name: 'manager', level: 90 }],
  is_superuser: false,
};
const mockRefreshUserData = () => Promise.resolve(mockManagerUser);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../context/AuthContext', () => {
  return {
    useAuth: () => ({
      user: mockManagerUser,
      refreshUserData: mockRefreshUserData,
    }),
  };
});

vi.mock('../services/api', () => {
  return {
    default: {
      get: (...args) => apiGet(...args),
      post: (...args) => apiPost(...args),
    },
  };
});

vi.mock('../components/AddressInput', () => {
  return {
    default: function AddressInputMock({ onChange }) {
      return (
        <button
          type="button"
          data-testid="address-input"
          onClick={() => onChange(mockAddressData)}
        >
          Set address
        </button>
      );
    },
  };
});

function renderUpload(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reports/upload" element={<ReportUpload />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReportUpload', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    apiGet.mockReset();
    apiPost.mockReset();
    mockAddressData = {
      formatted_address: '123 Main St, Testville, TX 00000',
      address_line1: '123 Main St',
      google_place_id: 'place-123',
      latitude: 1.23,
      longitude: 4.56,
    };

    apiGet.mockImplementation((url, config) => {
      if (url === '/api/v1/companies/') {
        return Promise.resolve({
          data: [
            { id: 77, name: 'Acme' },
            { id: 88, name: 'Other Co' },
          ],
        });
      }
      if (url === '/api/v1/projects/123') {
        return Promise.resolve({
          data: { id: 123, name: 'Project 123', company_id: 77, status: 'open' },
        });
      }
      if (url === '/api/v1/companies/77/projects') {
        return Promise.resolve({
          data: {
            projects: [
              { id: 123, name: 'Project 123', status: 'open' },
              { id: 456, name: 'Project 456', status: 'closed' },
            ],
          },
        });
      }
      if (url === '/api/v1/projects/123/technicians') {
        return Promise.resolve({
          data: [{ id: 7, first_name: 'Tina', last_name: 'Tech' }],
        });
      }
      if (url === '/api/v1/users/employees') {
        return Promise.resolve({
          data: [
            { id: 7, first_name: 'Tina', last_name: 'Tech', email: 'tina@example.com', roles: [] },
            { id: 8, first_name: 'Uma', last_name: 'Unassigned', email: 'uma@example.com', roles: [] },
          ],
        });
      }
      if (url === '/api/v1/reports/locations' && config?.params?.project_id === '123') {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error(`Unhandled GET ${url}`));
    });

    apiPost.mockResolvedValue({ data: { id: 99 } });
  });

  it('preselects company from companyId', async () => {
    renderUpload('/reports/upload?companyId=77');

    const companySelect = await screen.findByDisplayValue('Acme');
    expect(companySelect).toHaveValue('77');

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/v1/companies/77/projects');
    });
  });

  it('preselects company and project from projectId', async () => {
    renderUpload('/reports/upload?projectId=123');

    expect(await screen.findByDisplayValue('Acme')).toHaveValue('77');
    expect(await screen.findByDisplayValue('Project 123')).toHaveValue('123');
  });

  it('renders title-case upload selections', async () => {
    renderUpload('/reports/upload?projectId=123');

    expect(await screen.findByDisplayValue('Select A Type...')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Personal' })).toHaveValue('personal');
    expect(screen.getByRole('option', { name: 'Clearance' })).toHaveValue('clearance');
    expect(screen.getByRole('option', { name: 'Area' })).toHaveValue('area');
    expect(await screen.findByText('Status: Open')).toBeInTheDocument();
  });

  it('submits selected technician metadata from a searchable combobox', async () => {
    const user = userEvent.setup();

    renderUpload('/reports/upload?projectId=123');

    await screen.findByDisplayValue('Project 123');

    await user.selectOptions(screen.getByDisplayValue('Select A Type...'), ['personal']);
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2026-02-24' } });
    await user.type(screen.getByPlaceholderText('Worker name'), 'Worker One');

    const technicianInput = screen.getByRole('combobox', { name: /technician/i });
    await user.click(technicianInput);
    await user.type(technicianInput, 'Tina');
    await user.click(await screen.findByRole('option', { name: /tina tech/i }));

    const file = new File(['%PDF-1.4 test'], 'report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('PDF File'), file);
    await user.click(screen.getByTestId('address-input'));
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => expect(apiPost).toHaveBeenCalled());

    const formData = apiPost.mock.calls[0][1];
    expect(formData.get('technician_user_id')).toBe('7');
    expect(formData.get('technician_name')).toBe('Tina Tech');
  });

  it('assigns an unassigned selected employee before upload', async () => {
    const user = userEvent.setup();

    renderUpload('/reports/upload?projectId=123');

    await screen.findByDisplayValue('Project 123');

    await user.selectOptions(screen.getByDisplayValue('Select A Type...'), ['clearance']);
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2026-02-24' } });

    const technicianInput = screen.getByRole('combobox', { name: /technician/i });
    await user.click(technicianInput);
    await user.type(technicianInput, 'Uma');
    await user.click(await screen.findByRole('option', { name: /uma unassigned/i }));

    const file = new File(['%PDF-1.4 test'], 'report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('PDF File'), file);
    await user.click(screen.getByTestId('address-input'));
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));

    expect(apiPost.mock.calls[0][0]).toBe('/api/v1/projects/123/technicians');
    expect(apiPost.mock.calls[0][1]).toEqual({ user_id: 8 });

    const formData = apiPost.mock.calls[1][1];
    expect(formData.get('technician_user_id')).toBe('8');
    expect(formData.get('technician_name')).toBe('Uma Unassigned');
  });

  it('submits a freeform technician name without assigning a project technician', async () => {
    const user = userEvent.setup();

    renderUpload('/reports/upload?projectId=123');

    await screen.findByDisplayValue('Project 123');

    await user.selectOptions(screen.getByDisplayValue('Select A Type...'), ['area']);
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2026-02-24' } });
    await user.type(screen.getByRole('combobox', { name: /technician/i }), 'Outside Person');

    const file = new File(['%PDF-1.4 test'], 'report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('PDF File'), file);
    await user.click(screen.getByTestId('address-input'));
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));

    expect(apiPost.mock.calls[0][0]).toBe('/api/v1/reports/upload');
    const formData = apiPost.mock.calls[0][1];
    expect(formData.get('technician_user_id')).toBeNull();
    expect(formData.get('technician_name')).toBe('Outside Person');
  });

  it('preserves the street number when Google formatted address omits it', async () => {
    const user = userEvent.setup();
    mockAddressData = {
      formatted_address: 'Main St, Testville, TX 00000',
      address_line1: '123 Main St',
      google_place_id: 'place-123',
      latitude: 1.23,
      longitude: 4.56,
    };

    renderUpload('/reports/upload?projectId=123');

    await screen.findByDisplayValue('Project 123');
    await user.selectOptions(screen.getByDisplayValue('Select A Type...'), ['area']);
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2026-02-24' } });

    const file = new File(['%PDF-1.4 test'], 'report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('PDF File'), file);
    await user.click(screen.getByTestId('address-input'));
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));

    const formData = apiPost.mock.calls[0][1];
    expect(formData.get('formatted_address')).toBe('123 Main St, Testville, TX 00000');
  });

  it('rejects route-only addresses without a street number', async () => {
    const user = userEvent.setup();
    mockAddressData = {
      formatted_address: 'Main St, Testville, TX 00000',
      address_line1: 'Main St',
      google_place_id: 'place-123',
      latitude: 1.23,
      longitude: 4.56,
    };

    renderUpload('/reports/upload?projectId=123');

    await screen.findByDisplayValue('Project 123');
    await user.selectOptions(screen.getByDisplayValue('Select A Type...'), ['area']);
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '2026-02-24' } });

    const file = new File(['%PDF-1.4 test'], 'report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('PDF File'), file);
    await user.click(screen.getByTestId('address-input'));
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByText(/location must include a street number/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('shows selected filename in the PDF upload bubble', async () => {
    const user = userEvent.setup();

    renderUpload('/reports/upload?projectId=123');

    await screen.findByDisplayValue('Project 123');
    await user.selectOptions(screen.getByDisplayValue('Select A Type...'), ['area']);

    expect(screen.getByText('Choose PDF')).toBeInTheDocument();

    const file = new File(['%PDF-1.4 test'], 'bubble-report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('PDF File'), file);

    expect(await screen.findByText('bubble-report.pdf')).toBeInTheDocument();
  });
});
