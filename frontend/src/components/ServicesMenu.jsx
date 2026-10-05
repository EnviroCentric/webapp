import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { services, serviceAnchor, serviceLabel } from '../data/services';
export default function ServicesMenu({ mobile = false, onNavigate = () => {} }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => {
    const close = event => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <div ref={ref} className={mobile ? 'services-menu mobile-services-menu' : 'services-menu'} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); ref.current.querySelector('button').focus(); } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button className="services-menu-toggle" type="button" aria-expanded={open} aria-controls={mobile ? 'mobile-service-links' : 'desktop-service-links'} onClick={() => setOpen(!open)}>Services <span aria-hidden="true">⌄</span></button>
    {open && <div className="services-mega-menu" id={mobile ? 'mobile-service-links' : 'desktop-service-links'}><Link to="/services" className="all-services" onClick={onNavigate}>Explore all services →</Link><div className="service-menu-columns">{services.map(service => <div key={service.id}><Link className="service-menu-heading" to={`/services#${service.id}`} onClick={onNavigate}>{service.title}</Link>{service.services.map(sub => <Link key={sub.name} to={`/services#${serviceAnchor(sub.name)}`} onClick={onNavigate}>{serviceLabel(sub.name)}</Link>)}</div>)}</div></div>}
  </div>;
}
ServicesMenu.propTypes = { mobile: PropTypes.bool, onNavigate: PropTypes.func };
