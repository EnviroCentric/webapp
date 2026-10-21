import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { isServicePath } from '../data/serviceSlides';

export default function PageScrollRestoration() {
  const { pathname, search, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(null);
  const positions = useRef(new Map());
  const activePage = useRef(pathname + search);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const save = () => positions.current.set(activePage.current, { x: window.scrollX, y: window.scrollY });
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      window.removeEventListener('scroll', save);
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const keepCarouselPosition = !hash && navigationType !== 'POP' && isServicePath(previousPath.current || '') && isServicePath(pathname);
    previousPath.current = pathname;
    activePage.current = pathname + search;
    if (keepCarouselPosition) return;
    let target;
    if (hash) {
      try { target = document.getElementById(decodeURIComponent(hash.slice(1))); }
      catch { /* Malformed anchors fall back to the saved page position. */ }
    }
    if (target) target.scrollIntoView({ block: isServicePath(pathname) && window.matchMedia?.('(min-width: 1024px)').matches ? 'nearest' : 'start', behavior: 'instant' });
    else {
      const saved = positions.current.get(activePage.current) || { x: 0, y: 0 };
      window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
    }
  }, [pathname, search, hash, key, navigationType]);

  return null;
}
