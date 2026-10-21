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

it('defaults to clear glass and remembers the dark toggle across navigation and reloads', () => {
  const initial = show();
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-2');
  expect(screen.getByRole('switch', { name: 'Dark text boxes' })).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(screen.getByRole('switch', { name: 'Dark text boxes' }));
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-3');
  expect(localStorage.getItem('readabilityMode')).toBe('3');
  fireEvent.click(screen.getByRole('link', { name: 'Services' }));
  expect(screen.getByText('Service content')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Dark text boxes' })).toHaveAttribute('aria-checked', 'true');
  initial.unmount();
  show();
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-3');
  fireEvent.click(screen.getByRole('switch', { name: 'Dark text boxes' }));
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-2');
  expect(screen.queryByRole('button', { name: /No text boxes/ })).not.toBeInTheDocument();
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
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-2');
  fireEvent.click(screen.getByRole('switch', { name: 'Dark text boxes' }));
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-3');
});

it('migrates the removed no-box preference to clear glass', () => {
  localStorage.setItem('readabilityMode', '1');
  show();
  expect(screen.getByTestId('shell')).toHaveClass('text-box-mode-2');
});
