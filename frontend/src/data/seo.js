import { serviceSlides } from './serviceSlides.js';

export const siteUrl = 'https://enviro-centric.com';

export const publicPages = {
  '/': {
    title: 'Envirocentric | Asbestos, Lead & Mold Testing in California',
    description: 'Envirocentric provides asbestos, lead, mold and hazardous materials testing and environmental consulting throughout California.',
  },
  '/services': {
    title: 'Environmental Testing Services in California | Envirocentric',
    description: 'Explore asbestos inspections, lead testing, mold and indoor air quality assessments, clearance testing and hazardous waste consulting across California.',
  },
  '/our-projects': {
    title: 'Environmental Consulting Clients & Projects | Envirocentric',
    description: 'Envirocentric supports homeowners, contractors, developers, healthcare facilities and government agencies with environmental consulting throughout California.',
  },
  '/contact': {
    title: 'Contact Envirocentric | California Environmental Testing',
    description: 'Request environmental testing and consulting services in California. Contact Envirocentric for asbestos, lead, mold and hazardous materials assessments.',
  },
};

for (const slide of serviceSlides) {
  publicPages[slide.path] = { title: `${slide.title} | Envirocentric`, description: slide.description };
}

export const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${siteUrl}/#organization`,
  name: 'Envirocentric',
  alternateName: 'Envirocentric',
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  description: publicPages['/'].description,
  email: 'info@enviro-centric.com',
  telephone: '+1-714-335-5973',
  areaServed: { '@type': 'State', name: 'California' },
  contactPoint: [
    { '@type': 'ContactPoint', telephone: '+1-714-335-5973', contactType: 'customer service' },
    { '@type': 'ContactPoint', telephone: '+1-619-779-1698', contactType: 'customer service' },
  ],
};

export function pageMetadata(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = publicPages[path];
  return page ? { ...page, canonical: siteUrl + path, robots: 'index, follow' } : {
    title: 'Envirocentric', description: '', canonical: null, robots: 'noindex, follow',
  };
}
