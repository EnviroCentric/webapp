import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Link } from 'react-router-dom';
import ReadabilityControl from './ReadabilityControl';
import { useTextBoxes } from '../hooks/useTextBoxes';

function Preview() {
  const [enabled, toggle] = useTextBoxes();
  return <><ReadabilityControl checked={enabled} onToggle={toggle} /><Link to="/services">Services</Link></>;
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

it('defaults to no boxes and remembers the two-state switch across navigation and reload', () => {
  const initial = show();
  const toggle = screen.getByRole('switch', { name: 'Readability backgrounds' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(screen.queryByRole('button', { name: /Crystal glass/ })).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(localStorage.getItem('showTextBoxes')).toBe('true');
  fireEvent.click(screen.getByRole('link', { name: 'Services' }));
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  initial.unmount();
  show();
  const restored = screen.getByRole('switch', { name: 'Readability backgrounds' });
  expect(restored).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(restored);
  expect(restored).toHaveAttribute('aria-checked', 'false');
  expect(localStorage.getItem('showTextBoxes')).toBe('false');
});

it('migrates the numbered dark style but prefers an explicit saved toggle choice', () => {
  localStorage.setItem('readabilityMode', '3');
  const initial = show();
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  initial.unmount();
  localStorage.setItem('showTextBoxes', 'false');
  show();
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});

it('defaults to no boxes and still toggles when browser storage is blocked', () => {
  localStorage.getItem.mockImplementation(() => { throw new Error('blocked'); });
  localStorage.setItem.mockImplementation(() => { throw new Error('blocked'); });
  show();
  const toggle = screen.getByRole('switch');
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
});
