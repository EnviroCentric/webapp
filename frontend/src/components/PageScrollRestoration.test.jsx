import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import { afterEach, it, expect, vi } from 'vitest';
import PageScrollRestoration from './PageScrollRestoration';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('restores each page independently after visiting a shorter page', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<MemoryRouter><PageScrollRestoration /><Link to="/">Home</Link><Link to="/services">Services</Link><Link to="/our-projects">Projects</Link></MemoryRouter>);
  const save = y => { Object.defineProperty(window, 'scrollY', { configurable: true, value: y }); fireEvent.scroll(window); };
  save(420);
  fireEvent.click(screen.getByText('Services'));
  expect(scroll).toHaveBeenLastCalledWith({ left: 0, top: 0, behavior: 'instant' });
  save(1500);
  fireEvent.click(screen.getByText('Home'));
  expect(scroll).toHaveBeenLastCalledWith({ left: 0, top: 420, behavior: 'instant' });
  fireEvent.click(screen.getByText('Projects'));
  save(0);
  fireEvent.click(screen.getByText('Home'));
  expect(scroll).toHaveBeenLastCalledWith({ left: 0, top: 420, behavior: 'instant' });
  fireEvent.click(screen.getByText('Services'));
  expect(scroll).toHaveBeenLastCalledWith({ left: 0, top: 1500, behavior: 'instant' });
});
it('scrolls to anchors after the destination page mounts', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const anchorScroll = vi.fn();
  const previous = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = anchorScroll;
  try {
    render(<MemoryRouter><PageScrollRestoration /><Link to="/services#lead">Lead</Link><Routes><Route path="/services" element={<section id="lead" />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByText('Lead'));
    expect(anchorScroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
  } finally { Element.prototype.scrollIntoView = previous; }
});

it('keeps the carousel in place when switching service URLs', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<MemoryRouter initialEntries={['/services/asbestos']}><PageScrollRestoration /><Link to="/services/lead">Lead</Link><Link to="/contact">Contact</Link></MemoryRouter>);
  scroll.mockClear();
  fireEvent.click(screen.getByText('Lead'));
  expect(scroll).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Contact'));
  expect(scroll).toHaveBeenLastCalledWith({ left: 0, top: 0, behavior: 'instant' });
});
