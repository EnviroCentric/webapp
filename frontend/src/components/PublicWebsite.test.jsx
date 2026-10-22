import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RequestServicesForm from './RequestServicesForm';
import ServicesMenu from './ServicesMenu';
import LandscapeBackground from './LandscapeBackground';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('public website interactions', () => {
  it('submits to the default backend endpoint and confirms delivery', async () => {
    vi.stubEnv('VITE_CONTACT_FORM_URL', '');
    vi.stubEnv('VITE_API_URL', '');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'submitted' }) }));
    render(<RequestServicesForm/>);
    fireEvent.change(screen.getByLabelText('First name *'), { target: { value: 'Alex' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Submit request' }).closest('form'));
    expect(await screen.findByRole('status')).toHaveTextContent('Your request has been submitted');
    expect(fetch).toHaveBeenCalledWith('/api/v1/contact', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByLabelText('First name *')).toHaveValue('Alex');
  });
  it('reports failed delivery without claiming success', async () => {
    vi.stubEnv('VITE_CONTACT_FORM_URL', '/request');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<RequestServicesForm/>);
    fireEvent.submit(screen.getByRole('button', { name: 'Submit request' }).closest('form'));
    expect(await screen.findByText(/We could not submit/)).toBeInTheDocument();
  });
  it('opens service links on hover and closes the menu with Escape or pointer exit', () => {
    render(<MemoryRouter><ServicesMenu/></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Services', exact: true });
    expect(link).toHaveAttribute('href', '/services');
    fireEvent.mouseEnter(link.closest('.services-menu'));
    expect(screen.getAllByRole('link', { name: 'Project Monitoring' })[0]).toHaveAttribute('href', '/services/asbestos#asbestos-project-monitoring');
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(link).toHaveAttribute('aria-expanded', 'false');
    expect(link).toHaveFocus();
    fireEvent.mouseEnter(link.closest('.services-menu'));
    fireEvent.mouseLeave(link.closest('.services-menu'));
    expect(link).toHaveAttribute('aria-expanded', 'false');
  });
  it('navigates to Services when the navbar label is clicked', () => {
    render(<MemoryRouter><ServicesMenu/><Routes><Route path="/" element={<p>Home page</p>}/><Route path="/services" element={<p>Services page</p>}/></Routes></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Services', exact: true });
    fireEvent.mouseEnter(link.closest('.services-menu'));
    fireEvent.click(link);
    expect(screen.getByText('Services page')).toBeInTheDocument();
    expect(link).toHaveAttribute('aria-expanded', 'false');
  });
  it('opens the desktop menu for keyboard focus and separates the mobile toggle from navigation', () => {
    const desktop = render(<MemoryRouter><ServicesMenu/></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Services', exact: true });
    fireEvent.focus(link);
    expect(screen.getByRole('link', { name: 'Explore all services →' })).toBeInTheDocument();
    desktop.unmount();
    render(<MemoryRouter><ServicesMenu mobile/></MemoryRouter>);
    const toggle = screen.getByRole('button', { name: 'Show service menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Services', exact: true })).toHaveAttribute('href', '/services');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
  it('uses the Big Sur image without slideshow controls', () => {
    const { container } = render(<MemoryRouter><LandscapeBackground/></MemoryRouter>);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelector('img')).toHaveAttribute('src', '/big-sur.jpg');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
