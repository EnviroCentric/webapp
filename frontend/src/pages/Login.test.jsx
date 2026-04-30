import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Login from './Login';

vi.mock('../context/AuthContext', () => {
  return {
    useAuth: () => ({
      login: vi.fn(),
    }),
  };
});

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists only the email address for the login modal', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'SecretPass123!');

    expect(localStorage.getItem('loginEmail')).toBe('jane@example.com');
    expect(localStorage.getItem('loginFormData')).toBeNull();
  });

  it('migrates legacy cached login data without restoring the password', () => {
    localStorage.setItem(
      'loginFormData',
      JSON.stringify({ email: 'legacy@example.com', password: 'OldSecret123!' })
    );

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/email address/i)).toHaveValue('legacy@example.com');
    expect(screen.getByLabelText(/password/i)).toHaveValue('');
    expect(localStorage.getItem('loginEmail')).toBe('legacy@example.com');
    expect(localStorage.getItem('loginFormData')).toBeNull();
  });
});
