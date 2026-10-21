import React from 'react';
import RequestServicesForm from '../components/RequestServicesForm';
export default function Contact() {
  return <div className="contact-page"><header><h1>Contact Us</h1><p>Tell us how we can help with your environmental testing and consulting needs.</p></header><div className="contact-layout"><aside><h2>Get in touch</h2><div className="contact-actions"><a className="site-button contact-action" href="tel:+17143355973" aria-label="Call (714) 335-5973">(714) 335-5973</a><a className="site-button contact-action" href="tel:+16197791698" aria-label="Call (619) 779-1698">(619) 779-1698</a><a className="site-button contact-action" href="mailto:info@enviro-centric.com" aria-label="Email info@enviro-centric.com">info@enviro-centric.com</a></div><p>Serving all of California</p></aside><RequestServicesForm/></div></div>;
}
