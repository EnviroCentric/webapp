import React from 'react';
import RequestServicesForm from '../components/RequestServicesForm';
export default function Contact() {
  return <div className="contact-page"><header><p className="eyebrow">Enviro-Centric</p><h1>Contact Us</h1><p>Tell us how we can help with your environmental testing and consulting needs.</p></header><div className="contact-layout"><aside><h2>Get in touch</h2><p><a href="tel:+17143355973">(714) 335-5973</a></p><p><a href="tel:+16197791698">(619) 779-1698</a></p><p>info@enviro-centric.com</p><p>P.O. Box 122202<br/>Chula Vista, CA 91912</p><p>Serving all of California</p></aside><RequestServicesForm/></div></div>;
}
