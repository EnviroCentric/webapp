import React from 'react';
import { Link } from 'react-router-dom';
export default function ContactBanner() {
  return <section className="contact-banner"><h2>Let’s talk about your project.</h2><p>Environmental testing and consulting throughout California.</p><div><Link className="site-button" to="/contact#request-services">Request our services</Link><a className="site-button" href="tel:+17143355973">Call (714) 335-5973</a></div></section>;
}
