import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import ReadabilityControl from './ReadabilityControl';
import { useReadabilityMode } from '../hooks/useReadabilityMode';

function Preview() {
  const [mode, change] = useReadabilityMode();
  return <div data-testid="shell" className={`text-box-mode-${mode}`}>
    <ReadabilityControl value={mode} onChange={change} />
    <Link to="/services">Services</Link>
    <Routes><Route path="/" element={<p>Home</p>} /><Route path="/services" element={<p>Service content</p>} /></Routes>
  </div>;
}
function show() { return render(<MemoryRouter><Preview /></MemoryRouter>); }
beforeEach(() => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(key => saved.get(key) ?? null),
    setItem: vi.fn((key, value) => saved.set(key, String(value))),
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('offers three named styles and preserves the selection across navigation and reloads', () => {
  const initial = show();
  expect(screen.getByRole('button', { name: '1: No text boxes' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '2: Crystal glass text boxes' }));
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-2');
  expect(localStorage.getItem('readabilityMode')).toBe('2');
  fireEvent.click(screen.getByRole('link', { name: 'Services' }));
  expect(screen.getByText('Service content')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '2: Crystal glass text boxes' })).toHaveAttribute('aria-pressed', 'true');
  initial.unmount();
  show();
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-2');
  fireEvent.click(screen.getByRole('button', { name: '3: Dark text boxes' }));
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-3');
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
});

it('maps the previous enabled toggle to dark boxes and prefers a saved numbered mode', () => {
  localStorage.setItem('showTextBoxes', 'true');
  const legacy = show();
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-3');
  legacy.unmount();
  localStorage.setItem('readabilityMode', '2');
  show();
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-2');
});

it('keeps the style control usable when storage is blocked', () => {
  localStorage.getItem.mockImplementation(() => { throw new Error('blocked'); });
  localStorage.setItem.mockImplementation(() => { throw new Error('blocked'); });
  show();
  fireEvent.click(screen.getByRole('button', { name: '2: Crystal glass text boxes' }));
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-2');
});
