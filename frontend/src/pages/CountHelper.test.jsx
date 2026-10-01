import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CountHelper from './CountHelper';
import { COUNT_HELPER_STORAGE_KEY } from '../utils/countHelper';

const apiPut = vi.fn();
const setUser = vi.fn();
vi.mock('../services/api', () => ({ default: { put: (...args) => apiPut(...args) } }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 7,
      count_feedback_sound_enabled: true,
      count_completion_sound_enabled: true,
    },
    setUser,
  }),
}));

const storage = new Map();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  },
});

describe('CountHelper', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    apiPut.mockReset();
    setUser.mockReset();
  });

  it('maps numpad keys and persists the count', () => {
    render(<CountHelper />);
    fireEvent.keyDown(window, { code: 'Numpad8' });
    fireEvent.keyDown(window, { code: 'Numpad5' });
    const totals = within(screen.getByRole('region', { name: 'Count totals' }));
    expect(totals.getByText('1.5')).toBeInTheDocument();

    fireEvent.keyDown(window, { code: 'Numpad6' });
    expect(totals.getByText('1', { selector: '.text-3xl' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(COUNT_HELPER_STORAGE_KEY)).completedFields).toBe(1);
  });

  it('locks input and shows overloaded when fiber total reaches 100', () => {
    const fields = Array(100).fill(null);
    fields[0] = 99.5;
    localStorage.setItem(COUNT_HELPER_STORAGE_KEY, JSON.stringify({
      version: 1,
      fields,
      currentField: 0,
      completedFields: 0,
      status: 'active',
    }));
    render(<CountHelper />);
    fireEvent.keyDown(window, { code: 'Numpad5' });
    expect(screen.getByRole('status')).toHaveTextContent('Overloaded');
    const totals = within(screen.getByRole('region', { name: 'Count totals' }));
    expect(totals.getByText('100.5')).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Numpad2' });
    expect(totals.getByText('100.5')).toBeInTheDocument();
  });

  it('requires confirmation before resetting', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CountHelper />);
    fireEvent.keyDown(window, { code: 'Numpad5' });
    fireEvent.click(screen.getByRole('button', { name: 'Start New Count' }));
    const totals = within(screen.getByRole('region', { name: 'Count totals' }));
    expect(totals.getByText('1', { selector: '.text-3xl' })).toBeInTheDocument();
  });

  it('saves key-feedback and completion sound preferences separately', async () => {
    apiPut.mockResolvedValueOnce({
      data: { count_feedback_sound_enabled: false, count_completion_sound_enabled: true },
    });
    render(<CountHelper />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute key feedback' }));
    expect(apiPut).toHaveBeenCalledWith('/api/v1/users/me/count-helper-preferences', {
      count_feedback_sound_enabled: false,
      count_completion_sound_enabled: true,
    });
    expect(await screen.findByRole('button', { name: 'Unmute key feedback' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mute completion ding' })).toBeInTheDocument();
  });
});
