import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { services, serviceAnchor, serviceLabel } from '../data/services';
import ServiceIcon from '../components/ServiceIcon';
import LandscapeBackground from '../components/LandscapeBackground';
import ContactBanner from '../components/ContactBanner';
export default function ServiceInfo() {
  const location = useLocation();
  const [active, setActive] = useState(0);
  useEffect(() => {
    const element = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (element) element.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [location]);
  useEffect(() => {
    let frame;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      let current = 0;
      services.forEach((service, index) => { if (document.getElementById(service.id)?.getBoundingClientRect().top <= window.innerHeight * .45) current = index; });
      setActive(current);
    }); };
    update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);
  return <div className="landscape-page services-page"><LandscapeBackground active={active}/><div className="landscape-content">
    <header className="services-intro reading-panel"><p className="eyebrow">Enviro-Centric</p><h1>Our Services</h1><p>Environmental testing and consulting for asbestos, lead, microbial and hazardous materials.</p></header>
    <div className="service-column">{services.map(service => <section key={service.id} id={service.id} className="service-section">
      <header className={`reading-panel service-heading service-color-${service.id}`}><ServiceIcon type={service.id}/><h2>{service.title}</h2><h3>{service.subtitle}</h3><p>{service.description}</p></header>
      <div className="service-tiles">{service.services.map(sub => <article key={sub.name} id={serviceAnchor(sub.name)} className="reading-panel service-tile"><h3>{serviceLabel(sub.name)}</h3><p>{sub.description}</p><ul>{sub.details.map(detail => <li key={detail}>{detail}</li>)}</ul></article>)}</div>
    </section>)}</div><ContactBanner/></div></div>;
}
