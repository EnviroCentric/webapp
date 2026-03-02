import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminPortal from './AdminPortal';

const mockNavigate = vi.fn();

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
      user: {
        is_superuser: true,
        roles: [],
      },
    }),
  };
});

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();

let clipboardWriteTextSpy;

vi.mock('../services/api', () => {
  return {
    default: {
      get: (...args) => apiGet(...args),
      post: (...args) => apiPost(...args),
      put: (...args) => apiPut(...args),
    },
  };
});

vi.mock('../components/AddressInput', () => {
  return {
    default: function AddressInputMock() {
      return <div data-testid="address-input" />;
    },
  };
});

describe('AdminPortal', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();

    // Mock/spy clipboard API (jsdom may provide a non-mock implementation)
    if (clipboardWriteTextSpy) clipboardWriteTextSpy.mockRestore();

    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: {},
        configurable: true,
      });
    }

    if (!navigator.clipboard.writeText) {
      Object.defineProperty(navigator.clipboard, 'writeText', {
        value: async () => undefined,
        configurable: true,
        writable: true,
      });
    }

    clipboardWriteTextSpy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);

    apiGet.mockImplementation((url) => {
      if (url === '/api/v1/companies/') return Promise.resolve({ data: [{ id: 1, name: 'Acme' }] });
      if (url === '/api/v1/roles/') {
        return Promise.resolve({
          data: [
            { id: 10, name: 'super_admin', level: 100 },
            { id: 11, name: 'fieldTechnician', level: 50 },
          ],
        });
      }
      if (url === '/api/v1/companies/1/projects') {
        return Promise.resolve({
          data: {
            projects: [{ id: 200, name: 'Project One' }],
          },
        });
      }
      return Promise.reject(new Error(`Unhandled GET ${url}`));
    });

    apiPost.mockImplementation((url) => {
      if (url === '/api/v1/users/client') {
        return Promise.resolve({
          data: { default_password: 'TempPass123!' },
        });
      }

      if (url === '/api/v1/users') {
        return Promise.resolve({
          data: { id: 123, email: 'new.employee@example.com' },
        });
      }

      if (url === '/api/v1/projects/200/technicians') {
        return Promise.reject({
          response: {
            data: {
              detail: 'Technician role or higher required.',
            },
          },
        });
      }

      return Promise.reject(new Error(`Unhandled POST ${url}`));
    });

    apiPut.mockResolvedValue({});
  });

  it('renders category tabs and switches panels', async () => {
    const user = userEvent.setup();

    render(<AdminPortal />);

    // Wait for initial data load
    expect(await screen.findByRole('heading', { name: /admin portal/i })).toBeInTheDocument();

    const companyTab = screen.getByRole('tab', { name: /company/i });
    const projectTab = screen.getByRole('tab', { name: /project/i });
    const clientTab = screen.getByRole('tab', { name: /client/i });
    const employeeTab = screen.getByRole('tab', { name: /employee/i });

    expect(companyTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /create company/i })).toBeInTheDocument();

    await user.click(projectTab);
    expect(projectTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /create project/i })).toBeInTheDocument();

    await user.click(clientTab);
    expect(clientTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /create client account/i })).toBeInTheDocument();

    await user.click(employeeTab);
    expect(employeeTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /create employee account/i })).toBeInTheDocument();
  });

  it('copies the generated client password to the clipboard', async () => {
    const user = userEvent.setup();

    render(<AdminPortal />);

    // Wait for initial data load
    expect(await screen.findByRole('heading', { name: /admin portal/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /client/i }));

    const clientPanel = screen.getByRole('tabpanel', { name: /client/i });

    // Fill minimal required state for handler
    await user.selectOptions(within(clientPanel).getByRole('combobox'), ['1']);

    const textboxes = within(clientPanel).getAllByRole('textbox');
    // In client panel order: first name, last name, email, phone, 4-digit code
    await user.type(textboxes[0], 'Jane');
    await user.type(textboxes[1], 'Doe');
    await user.type(textboxes[2], 'jane@example.com');
    await user.type(textboxes[4], '1234');

    await user.click(screen.getByRole('button', { name: /create client/i }));

    expect(await screen.findByText(/default password/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /copy password/i }));
    expect(clipboardWriteTextSpy).toHaveBeenCalledWith('TempPass123!');
  });

  it('formats role names nicely and does not show role levels', async () => {
    const user = userEvent.setup();

    render(<AdminPortal />);
    expect(await screen.findByRole('heading', { name: /admin portal/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /employee/i }));

    expect(await screen.findByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('Field Technician')).toBeInTheDocument();
    expect(screen.queryByText(/lvl/i)).not.toBeInTheDocument();
  });

  it('still reports employee creation success even if project assignment fails', async () => {
    const user = userEvent.setup();

    render(<AdminPortal />);
    expect(await screen.findByRole('heading', { name: /admin portal/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /employee/i }));

    // Fill required employee fields
    const employeePanel = screen.getByRole('tabpanel', { name: /employee/i });
    const textboxes = within(employeePanel).getAllByRole('textbox');
    // Order: first, last, email, phone, password, confirm
    await user.type(textboxes[0], 'New');
    await user.type(textboxes[1], 'Employee');
    await user.type(textboxes[2], 'new.employee@example.com');
    await user.type(textboxes[4], 'TempPass123!');
    await user.type(textboxes[5], 'TempPass123!');

    // Select a role
    await user.click(screen.getByLabelText('Super Admin'));

    // Select assignment company -> triggers project list load
    const selects = within(employeePanel).getAllByRole('combobox');
    await user.selectOptions(selects[0], ['1']);

    // Select project
    await user.click(await screen.findByLabelText('Project One'));

    await user.click(screen.getByRole('button', { name: /create employee/i }));

    const createdEmail = await screen.findByText('new.employee@example.com');
    expect(createdEmail.closest('div')).toHaveTextContent(/employee created/i);
    expect(await screen.findByText(/project assignment failed/i)).toBeInTheDocument();
  });
});
