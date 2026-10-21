import { useEffect, useRef } from 'react';

const STOP_KEY = 'servicesAutoScrollStopped';
const PIXELS_PER_SECOND = 4;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

// Only the desktop information panel moves. Manual input disables it for the tab.
export function useSlowServiceScroll(panelRef, stageRef, pathname) {
  const stopped = useRef(false);
  useEffect(() => {
    const panel = panelRef.current;
    const desktop = window.matchMedia?.('(min-width: 1024px)');
    if (!panel || !desktop?.matches || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || stopped.current) return;
    try { if (sessionStorage.getItem(STOP_KEY) === 'true') return; } catch { /* Memory still preserves manual control until unmount. */ }

    let frame;
    let delay;
    let lastTime;
    let position = panel.scrollTop;
    let expectedTop = panel.scrollTop;
    function stop() {
      stopped.current = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delay);
      try { sessionStorage.setItem(STOP_KEY, 'true'); } catch { /* In-memory stop remains active. */ }
    }
    const onWheel = event => { if (!event.ctrlKey && (event.deltaX || event.deltaY)) stop(); };
    const onKey = event => { if (SCROLL_KEYS.has(event.key) && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) stop(); };
    const onScroll = () => { if (Math.abs(panel.scrollTop - expectedTop) > 1) stop(); };
    function tick(time) {
      if (stopped.current || !desktop.matches) return;
      const bounds = stageRef.current?.getBoundingClientRect();
      if (document.hidden || !bounds || bounds.top < 60 || bounds.top > 72) {
        lastTime = undefined;
        frame = window.requestAnimationFrame(tick);
        return;
      }
      if (lastTime !== undefined) {
        position += Math.min((time - lastTime) / 1000, .1) * PIXELS_PER_SECOND;
        panel.scrollTop = Math.min(position, Math.max(0, panel.scrollHeight - panel.clientHeight));
        expectedTop = panel.scrollTop;
      }
      lastTime = time;
      // Finish quietly at the bottom; auto-scroll never advances the carousel.
      if (panel.scrollTop < panel.scrollHeight - panel.clientHeight - 1) frame = window.requestAnimationFrame(tick);
    }
    window.addEventListener('wheel', onWheel, { passive: true, capture: true });
    window.addEventListener('touchmove', stop, { passive: true, capture: true });
    window.addEventListener('keydown', onKey, true);
    panel.addEventListener('pointerdown', stop);
    panel.addEventListener('scroll', onScroll, { passive: true });
    delay = window.setTimeout(() => { frame = window.requestAnimationFrame(tick); }, 3000);
    return () => {
      window.clearTimeout(delay);
      window.cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('touchmove', stop, true);
      window.removeEventListener('keydown', onKey, true);
      panel.removeEventListener('pointerdown', stop);
      panel.removeEventListener('scroll', onScroll);
    };
  }, [panelRef, stageRef, pathname]);
}
