import { services, serviceAnchor } from './services.js';

const presentation = {
  asbestos: { label: 'Asbestos', image: '/images/landscapes/coastal-cliffs.jpg', position: 'center 60%', title: 'Asbestos Inspections & Testing in California', description: 'Asbestos inspections, surveys, project monitoring and clearance testing for California homes, commercial properties and renovation or demolition projects.' },
  lead: { label: 'Lead', image: '/images/landscapes/wetlands.jpg', position: 'center 65%', title: 'Lead Inspections & Risk Assessments in California', description: 'Lead-based paint inspections, risk assessments, clearance testing and project monitoring for residential and commercial buildings throughout California.' },
  microbial: { label: 'Mold & Air Quality', image: '/images/landscapes/forest.jpg', position: 'center 55%', title: 'Mold Testing & Indoor Air Quality in California', description: 'Mold inspections, indoor air quality surveys, moisture assessments and post-remediation clearance testing for California properties.' },
  'hazardous-waste': { label: 'Hazardous Materials', image: '/big-sur.jpg', position: 'center', title: 'Hazardous Waste Testing & Consulting in California', description: 'Hazardous waste assessments, laboratory testing, disposal consultation and regulatory compliance support throughout California.' },
};

export const serviceSlides = services.map(service => ({ ...service, ...presentation[service.id], heading: service.title, path: `/services/${service.id}` }));
export const isServicePath = path => path.replace(/\/$/, '') === '/services' || serviceSlides.some(slide => slide.path === path.replace(/\/$/, ''));
export const slideForPath = path => serviceSlides.find(slide => slide.path === path.replace(/\/$/, '')) || serviceSlides[0];

export function slideForAnchor(hash) {
  let anchor;
  try { anchor = decodeURIComponent(hash.replace(/^#/, '')); } catch { return null; }
  return serviceSlides.find(slide => slide.id === anchor || slide.services.some(sub => serviceAnchor(sub.name) === anchor));
}
