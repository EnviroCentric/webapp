import React, { useRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSlowServiceScroll } from './useSlowServiceScroll';

let frames;
let id;
function Demo({ path = '/services/asbestos' }) {
  const panel = useRef(null);
  const stage = useRef(null);
  useSlowServiceScroll(panel, stage, path);
  return <section ref={stage} data-testid="stage"><div ref={panel} data-testid="panel" /></section>;
}
function setup() {
  const result = render(<Demo />);
  const panel = screen.getByTestId('panel');
  Object.defineProperties(panel, { scrollHeight: { configurable: true, value: 1200 }, clientHeight: { configurable: true, value: 300 } });
  vi.spyOn(screen.getByTestId('stage'), 'getBoundingClientRect').mockReturnValue({ top: 64, bottom: 800 });
  return { ...result, panel };
}
function step(time) {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback(time));
}
beforeEach(() => {
  vi.useFakeTimers();
  frames = new Map(); id = 0;
  const saved = new Map();
  vi.stubGlobal('sessionStorage', { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) });
  vi.stubGlobal('matchMedia', query => ({ matches: query.includes('min-width') }));
  vi.stubGlobal('requestAnimationFrame', callback => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', frame => frames.delete(frame));
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('waits before moving, scrolls very slowly, and finishes without changing services', () => {
  const { panel } = setup();
  vi.advanceTimersByTime(2999);
  expect(frames.size).toBe(0);
  vi.advanceTimersByTime(1);
  step(0);
  for (let time = 100; time <= 5000; time += 100) step(time);
  expect(panel.scrollTop).toBeCloseTo(20, 4);
  fireEvent.scroll(panel); // Its own scroll events must not disable animation.
  expect(sessionStorage.getItem('servicesAutoScrollStopped')).toBeNull();
  Object.defineProperty(panel, 'scrollHeight', { value: 320 });
  step(5100);
  expect(frames.size).toBe(0);
});

it('manual wheel input stops scrolling permanently, including navigation and remounting', () => {
  const current = setup();
  vi.advanceTimersByTime(3000); step(0); step(100);
  fireEvent.wheel(current.panel, { deltaY: 100 });
  const stoppedAt = current.panel.scrollTop;
  expect(frames.size).toBe(0);
  expect(sessionStorage.getItem('servicesAutoScrollStopped')).toBe('true');
  current.rerender(<Demo path="/services/lead" />);
  vi.advanceTimersByTime(60000); step(60000);
  expect(current.panel.scrollTop).toBe(stoppedAt);
  current.unmount();
  setup();
  vi.advanceTimersByTime(60000);
  expect(frames.size).toBe(0);
});

it.each(['touch', 'keyboard', 'scrollbar', 'external-scroll'])('stops immediately for %s input', input => {
  const { panel } = setup();
  if (input === 'touch') fireEvent.touchMove(panel);
  if (input === 'keyboard') fireEvent.keyDown(panel, { key: 'PageDown' });
  if (input === 'scrollbar') fireEvent.pointerDown(panel);
  if (input === 'external-scroll') { panel.scrollTop = 40; fireEvent.scroll(panel); }
  vi.advanceTimersByTime(10000);
  expect(frames.size).toBe(0);
  expect(sessionStorage.getItem('servicesAutoScrollStopped')).toBe('true');
});

it.each(['mobile', 'reduced-motion'])('does not auto-scroll in %s mode', mode => {
  vi.stubGlobal('matchMedia', query => ({ matches: mode === 'reduced-motion' || !query.includes('min-width') }));
  setup();
  vi.advanceTimersByTime(10000);
  expect(frames.size).toBe(0);
});
