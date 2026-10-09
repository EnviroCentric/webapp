import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { services, serviceAnchor, serviceLabel } from '../data/services';
import ServiceIcon from '../components/ServiceIcon';
export default function ServiceInfo() {
  const location = useLocation();
  useEffect(() => {
    const element = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (element) element.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [location]);
  return <div className="landscape-page services-page"><div className="landscape-content">
    <header className="services-intro reading-panel"><h1>Our Services</h1><p>Environmental testing and consulting for asbestos, lead, microbial and hazardous materials.</p></header>
    <div className="service-column">{services.map(service => <section key={service.id} id={service.id} className="service-section">
      <header className={`reading-panel service-heading service-color-${service.id}`}><ServiceIcon type={service.id}/><h2>{service.title}</h2><h3>{service.subtitle}</h3><p>{service.description}</p></header>
      <div className="service-tiles">{service.services.map(sub => <article key={sub.name} id={serviceAnchor(sub.name)} className="reading-panel service-tile"><h3>{serviceLabel(sub.name)}</h3><p>{sub.description}</p><ul>{sub.details.map(detail => <li key={detail}>{detail}</li>)}</ul></article>)}</div>
    </section>)}</div></div></div>;
}
