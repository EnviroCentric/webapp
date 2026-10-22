import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { services, serviceAnchor, serviceLabel } from '../data/services';
export default function ServicesMenu({ mobile = false, onNavigate = () => {} }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const linkRef = useRef(null);
  const toggleRef = useRef(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => {
    const close = event => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  function navigate() { setOpen(false); onNavigate(); }
  return <div ref={ref} className={mobile ? 'services-menu mobile-services-menu' : 'services-menu'}
    onMouseEnter={() => { if (!mobile) setOpen(true); }}
    onMouseLeave={() => { if (!mobile) setOpen(false); }}
    onFocus={() => { if (!mobile) setOpen(true); }}
    onKeyDown={event => { if (event.key === 'Escape') { (mobile ? toggleRef.current : linkRef.current)?.focus(); setOpen(false); } }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <div className="services-menu-trigger">
      <Link ref={linkRef} className="services-menu-link" to="/services" onClick={navigate} aria-expanded={mobile ? undefined : open} aria-controls={mobile ? undefined : 'desktop-service-links'}>Services{!mobile && <span aria-hidden="true"> ⌄</span>}</Link>
      {mobile && <button ref={toggleRef} className="services-menu-toggle" type="button" aria-label="Show service menu" aria-expanded={open} aria-controls="mobile-service-links" onClick={() => setOpen(!open)}><span aria-hidden="true">⌄</span></button>}
    </div>
    {open && <div className="services-mega-menu" id={mobile ? 'mobile-service-links' : 'desktop-service-links'}><Link to="/services" className="all-services" onClick={navigate}>Explore all services →</Link><div className="service-menu-columns">{services.map(service => <div key={service.id}><Link className="service-menu-heading" to={`/services/${service.id}`} onClick={navigate}>{service.title}</Link>{service.services.map(sub => <Link key={sub.name} to={`/services/${service.id}#${serviceAnchor(sub.name)}`} onClick={navigate}>{serviceLabel(sub.name)}</Link>)}</div>)}</div></div>}
  </div>;
}
ServicesMenu.propTypes = { mobile: PropTypes.bool, onNavigate: PropTypes.func };
