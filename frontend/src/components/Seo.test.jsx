import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import Seo from './Seo';

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('meta[name="description"], meta[name="robots"], link[rel="canonical"], #organization-schema').forEach(tag => tag.remove());
});

describe('search metadata during navigation', () => {
  it('updates canonical and description when moving between public pages', () => {
    render(<MemoryRouter initialEntries={['/']}><Seo /><Link to="/contact?source=home#request-services">Contact</Link></MemoryRouter>);
    expect(document.title).toContain('Asbestos, Lead & Mold');
    fireEvent.click(screen.getByRole('link', { name: 'Contact' }));
    expect(document.title).toContain('Contact Envirocentric');
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe('https://enviro-centric.com/contact');
    expect(document.head.querySelector('meta[name="description"]').content).toContain('Request environmental testing');
    expect(document.head.querySelectorAll('#organization-schema')).toHaveLength(1);
    const schema = JSON.parse(document.getElementById('organization-schema').textContent);
    expect(schema.alternateName).toBe('Envirocentric');
  });

  it('removes public metadata on account routes and restores it on returning', () => {
    render(<MemoryRouter initialEntries={['/services']}><Seo /><Link to="/projects/123">Portal</Link><Link to="/services/">Services</Link></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Portal' }));
    expect(document.head.querySelector('meta[name="robots"]').content).toBe('noindex, follow');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.getElementById('organization-schema')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Services' }));
    expect(document.head.querySelector('meta[name="robots"]').content).toBe('index, follow');
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe('https://enviro-centric.com/services');
  });
});
