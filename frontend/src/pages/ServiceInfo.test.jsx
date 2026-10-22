import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ServiceInfo from './ServiceInfo';
import Seo from '../components/Seo';
import LandscapeBackground from '../components/LandscapeBackground';

function HistoryControls() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output aria-label="Current URL">{location.pathname}{location.hash}</output><button onClick={() => navigate(-1)}>Back</button></>;
}
function show(path) {
  return render(<MemoryRouter initialEntries={[path]}><Seo /><LandscapeBackground /><ServiceInfo /><HistoryControls /></MemoryRouter>);
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.head.querySelectorAll('meta[name="description"], meta[name="robots"], link[rel="canonical"], #organization-schema').forEach(tag => tag.remove());
});

it('opens a service directly with its own content, photo and canonical URL', () => {
  const { container } = show('/services/microbial');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Microbial Services');
  expect(screen.getByRole('link', { name: 'Our Services', exact: true })).toBeInTheDocument();
  expect(screen.queryByText('CALIFORNIA · ENVIROCENTRIC')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Mold Inspections' })).toBeInTheDocument();
  expect(screen.queryByText('XRF testing of painted surfaces')).not.toBeInTheDocument();
  expect(container.querySelector('.landscape-background img')).toHaveAttribute('src', '/images/landscapes/forest.jpg');
  expect(document.head.querySelector('link[rel="canonical"]').href).toBe('https://www.enviro-centric.com/services/microbial');
});

it('changes pages through top service bubbles and supports browser back without bottom arrows', () => {
  show('/services/hazardous-waste');
  const serviceLink = name => within(screen.getByRole('navigation', { name: 'Choose a service' })).getByRole('link', { name, exact: true });
  expect(screen.queryByRole('link', { name: /Next service:/ })).not.toBeInTheDocument();
  fireEvent.click(serviceLink('Asbestos'));
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/asbestos');
  fireEvent.click(serviceLink('Lead'));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lead Services');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Asbestos Services');
  fireEvent.click(serviceLink('Hazardous Materials'));
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/hazardous-waste');
});

it('supports keyboard navigation without intercepting arrow keys on links', () => {
  show('/services/asbestos');
  const carousel = screen.getByRole('region', { name: 'Environmental services' });
  fireEvent.keyDown(carousel, { key: 'ArrowRight' });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lead Services');
  fireEvent.keyDown(within(carousel).getByRole('link', { name: 'Asbestos', exact: true }), { key: 'ArrowRight' });
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/lead');
});

it('preserves old category and subsection bookmarks', () => {
  show('/services#lead-risk-assessments');
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/lead#lead-risk-assessments');
  expect(screen.getByRole('heading', { name: 'Risk Assessments' })).toBeInTheDocument();
});

it('waits for the next photo and restores previously loaded photos when revisiting', () => {
  const { container } = show('/services/asbestos');
  const active = () => container.querySelector('.landscape-background img.is-active');
  fireEvent.load(active());
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Choose a service' })).getByRole('link', { name: 'Lead', exact: true }));
  expect(active()).toHaveAttribute('src', '/images/landscapes/coastal-cliffs.jpg');
  fireEvent.load(container.querySelector('img[src="/images/landscapes/wetlands.jpg"]'));
  expect(active()).toHaveAttribute('src', '/images/landscapes/wetlands.jpg');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(active()).toHaveAttribute('src', '/images/landscapes/coastal-cliffs.jpg');
});

it('recognizes horizontal touch swipes while allowing vertical scrolling', () => {
  show('/services/asbestos');
  const carousel = screen.getByRole('region', { name: 'Environmental services' });
  const pointer = (type, x, y) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    fireEvent(carousel, event);
  };
  pointer('pointerdown', 250, 100); pointer('pointerup', 230, 220);
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/asbestos');
  pointer('pointerdown', 250, 100); pointer('pointerup', 100, 110);
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/lead');
});

it('does not show asbestos or index unknown service URLs', () => {
  show('/services/missing');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Service not found');
  expect(document.head.querySelector('meta[name="robots"]').content).toBe('noindex, follow');
});

function desktopPanel(path = '/services/asbestos') {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  show(path);
  const carousel = screen.getByRole('region', { name: 'Environmental services' });
  const panel = screen.getByRole('region', { name: /service details$/ });
  Object.defineProperties(panel, { scrollHeight: { configurable: true, value: 1200 }, clientHeight: { configurable: true, value: 300 } });
  vi.spyOn(carousel, 'getBoundingClientRect').mockReturnValue({ top: 64, bottom: 800 });
  return { carousel, panel };
}

it('scrolls through the info panel before requiring extra scrolling to change services', () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(2000);
  const { carousel, panel } = desktopPanel();
  fireEvent.wheel(carousel, { deltaY: 240 });
  expect(panel.scrollTop).toBe(240);
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/asbestos');
  panel.scrollTop = 900;
  fireEvent.wheel(carousel, { deltaY: 80 });
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/asbestos');
  fireEvent.wheel(carousel, { deltaY: 120 });
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/lead');
  expect(panel.scrollTop).toBe(0);
  fireEvent.wheel(carousel, { deltaY: 1500 });
  expect(panel.scrollTop).toBe(0);
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/lead');
  now.mockReturnValue(3100);
  fireEvent.wheel(carousel, { deltaY: 240 });
  expect(panel.scrollTop).toBe(240);
});

it('lets the document scroll past the last service and leaves mobile scrolling native', () => {
  const { carousel, panel } = desktopPanel('/services/hazardous-waste');
  panel.scrollTop = 900;
  const endScroll = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 250 });
  fireEvent(carousel, endScroll);
  expect(endScroll.defaultPrevented).toBe(false);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  panel.scrollTop = 0;
  const mobileScroll = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 250 });
  fireEvent(carousel, mobileScroll);
  expect(mobileScroll.defaultPrevented).toBe(false);
  expect(panel.scrollTop).toBe(0);
});

it('scrolls backwards only after the threshold, returning to the previous panel bottom', () => {
  vi.spyOn(Date, 'now').mockReturnValue(2000);
  const { carousel, panel } = desktopPanel('/services/lead');
  fireEvent.wheel(carousel, { deltaY: -100 });
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/lead');
  fireEvent.wheel(carousel, { deltaY: -100 });
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/services/asbestos');
  // A real browser clamps this value to scrollHeight - clientHeight.
  expect(panel.scrollTop).toBe(1200);
});
