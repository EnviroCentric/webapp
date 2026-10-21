import React, { useEffect, useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { serviceAnchor, serviceLabel } from '../data/services';
import { serviceSlides, slideForPath, slideForAnchor, isServicePath } from '../data/serviceSlides';
export default function ServiceInfo() {
  const { pathname, hash, state } = useLocation();
  const navigate = useNavigate();
  const touch = useRef(null);
  const stage = useRef(null);
  const info = useRef(null);
  const wheel = useRef({ distance: 0, last: 0, lockedUntil: 0 });
  const service = slideForPath(pathname);
  const index = serviceSlides.indexOf(service);
  const previous = serviceSlides[(index + serviceSlides.length - 1) % serviceSlides.length];
  const next = serviceSlides[(index + 1) % serviceSlides.length];
  const overview = pathname.replace(/\/$/, '') === '/services';
  const legacy = overview && slideForAnchor(hash);

  useEffect(() => {
    if (info.current && !hash) info.current.scrollTop = state?.serviceScroll === 'end' ? info.current.scrollHeight : 0;
    wheel.current.distance = 0;
  }, [pathname, hash, state]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    function scrollService(event) {
      const panel = info.current;
      if (!panel || !window.matchMedia?.('(min-width: 1024px)').matches || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
      const bounds = element.getBoundingClientRect();
      // Outside the pinned stage, let the document scroll normally to its footer.
      if (bounds.top < 60 || bounds.top > 72) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? panel.clientHeight : 1);
      const now = Date.now();
      if (now < wheel.current.lockedUntil) { event.preventDefault(); return; }
      const bottom = Math.max(0, panel.scrollHeight - panel.clientHeight);
      const canReadMore = delta > 0 ? panel.scrollTop < bottom - 1 : panel.scrollTop > 1;
      if (canReadMore) {
        event.preventDefault();
        panel.scrollTop = Math.max(0, Math.min(bottom, panel.scrollTop + delta));
        wheel.current.distance = 0;
        wheel.current.last = now;
        return;
      }
      // At the first/last service, allow the user to leave the carousel normally.
      if ((delta > 0 && index === serviceSlides.length - 1) || (delta < 0 && index === 0)) return;
      event.preventDefault();
      if (now - wheel.current.last > 220 || Math.sign(wheel.current.distance) !== Math.sign(delta)) wheel.current.distance = 0;
      wheel.current.last = now;
      wheel.current.distance += delta;
      if (Math.abs(wheel.current.distance) >= 180) {
        wheel.current.distance = 0;
        wheel.current.lockedUntil = now + 1000;
        navigate(delta > 0 ? next.path : previous.path, { state: { serviceScroll: delta > 0 ? 'start' : 'end' } });
      }
    }
    element.addEventListener('wheel', scrollService, { passive: false });
    return () => element.removeEventListener('wheel', scrollService);
  }, [pathname, index, next.path, previous.path, navigate]);

  if (legacy) return <Navigate replace to={`${legacy.path}${hash === `#${legacy.id}` ? '' : hash}`} />;
  if (!isServicePath(pathname)) return <div className="service-not-found reading-panel"><h1>Service not found</h1><Link to="/services">Explore our services</Link></div>;

  function swipeEnd(event) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? next.path : previous.path);
  }

  const Heading = overview ? 'h2' : 'h1';
  return <div className="landscape-page services-page service-carousel-page"><div className="landscape-content">
    <section ref={stage} className="service-carousel" role="region" aria-roledescription="carousel" aria-label="Environmental services" tabIndex={0}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); navigate(event.key === 'ArrowRight' ? next.path : previous.path); }
      }}
      onPointerDown={event => { if (event.pointerType === 'touch' && !event.target.closest('a, button, input, .carousel-service-details')) touch.current = { x: event.clientX, y: event.clientY }; }}
      onPointerUp={swipeEnd} onPointerCancel={() => { touch.current = null; }}>
      <header className="carousel-topline"><Link to="/services">Our services</Link><span>CALIFORNIA · ENVIROCENTRIC</span></header>
      <div className="carousel-navigation"><nav className="carousel-services" aria-label="Choose a service">{serviceSlides.map(slide => <Link key={slide.id} to={slide.path} aria-current={slide.id === service.id ? 'page' : undefined}>{slide.label}</Link>)}</nav><p className="carousel-progress" aria-live="polite" aria-atomic="true"><span className="carousel-current-number">{String(index + 1).padStart(2, '0')}</span><span className="carousel-count-divider" /><span>{String(serviceSlides.length).padStart(2, '0')}</span><span className="sr-only">: {service.label}</span></p></div>
      <div className="carousel-layout">
      <div className="carousel-story" key={service.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${serviceSlides.length}: ${service.label}`}>
        <p className="carousel-eyebrow">Environmental testing & consulting</p>
        {overview && <h1 className="carousel-overview-title">Our Services</h1>}
        <Heading className="carousel-title">{service.heading}</Heading>
        <p className="carousel-subtitle">{service.subtitle}</p>
        <div className="carousel-actions"><Link className="site-button" to="/contact#request-services">Request our services <span aria-hidden="true">↗︎</span></Link><a className="carousel-details-link" href="#service-details">Explore {service.label.toLowerCase()} services <span aria-hidden="true">↓</span></a></div>
      </div>
      <section className="carousel-service-details" id="service-details" aria-labelledby="service-details-title">
        <div ref={info} className="carousel-info-scroll" tabIndex={0} role="region" aria-label={`${service.label} service details`}>
          <header><p className="carousel-eyebrow">How we can help</p><h2 id="service-details-title">{service.label} services</h2><p>{service.description}</p></header>
          <div className="carousel-detail-grid" key={`details-${service.id}`}>{service.services.map((sub, subIndex) => <article key={sub.name} id={serviceAnchor(sub.name)} className="carousel-detail-card"><span className="carousel-detail-number">{String(subIndex + 1).padStart(2, '0')}</span><h3>{serviceLabel(sub.name)}</h3><p>{sub.description}</p><ul>{sub.details.map(detail => <li key={detail}>{detail}</li>)}</ul></article>)}</div>
        </div>
        <p className="carousel-scroll-note">{index < serviceSlides.length - 1 ? `Scroll to explore · Up next: ${next.label}` : 'Scroll to explore our services'}</p>
      </section>
      </div>
    </section>
  </div></div>;
}
