import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RequestServicesForm from './RequestServicesForm';
import ServicesMenu from './ServicesMenu';
import LandscapeBackground from './LandscapeBackground';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('public website interactions', () => {
  it('keeps request details and reports when delivery is not configured', async () => {
    vi.stubEnv('VITE_CONTACT_FORM_URL', '');
    render(<RequestServicesForm/>);
    fireEvent.change(screen.getByLabelText('First name *'), { target: { value: 'Alex' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Submit request' }).closest('form'));
    expect(await screen.findByRole('status')).toHaveTextContent('Online submission is not available yet');
    expect(screen.getByLabelText('First name *')).toHaveValue('Alex');
  });
  it('reports failed delivery without claiming success', async () => {
    vi.stubEnv('VITE_CONTACT_FORM_URL', '/request');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<RequestServicesForm/>);
    fireEvent.submit(screen.getByRole('button', { name: 'Submit request' }).closest('form'));
    expect(await screen.findByText(/We could not submit/)).toBeInTheDocument();
  });
  it('offers subsection links and closes the menu with Escape', () => {
    render(<MemoryRouter><ServicesMenu/></MemoryRouter>);
    const toggle = screen.getByRole('button', { name: /Services/ });
    fireEvent.click(toggle);
    expect(screen.getAllByRole('link', { name: 'Project Monitoring' })[0]).toHaveAttribute('href', '/services#asbestos-project-monitoring');
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
  it('does not automatically rotate when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.useFakeTimers();
    render(<LandscapeBackground timed/>);
    vi.advanceTimersByTime(12000);
    expect(screen.getByRole('button', { name: 'Show landscape 1' })).toHaveAttribute('aria-pressed', 'true');
  });
});
