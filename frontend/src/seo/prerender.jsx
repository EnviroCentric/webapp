import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.js';
import Home from '../pages/Home';
import ServiceInfo from '../pages/ServiceInfo';
import PublicProjects from '../pages/PublicProjects';
import Contact from '../pages/Contact';
import LandscapeBackground from '../components/LandscapeBackground';
import ContactBanner from '../components/ContactBanner';
import ReadabilityControl from '../components/ReadabilityControl';

const pages = { '/': Home, '/services': ServiceInfo, '/our-projects': PublicProjects, '/contact': Contact };

// Render the same public content at build time; the client adds account controls
// and interactive navigation when it starts. No authenticated data is rendered.
export function renderPublicPage(path) {
  const Page = pages[path];
  return renderToString(<StaticRouter location={path}>
    <div className="min-h-screen site-slideshow-shell text-box-mode-1">
      <LandscapeBackground />
      <nav className="fixed top-0 left-0 right-0 z-50 site-navbar shadow-md" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 h-16">
          <a href="/" aria-label="Envirocentric home"><img src="/logo.png" alt="Envirocentric Logo" className="h-10 w-auto" /></a>
          <a href="/">Home</a><a href="/services">Services</a><a href="/our-projects">Projects</a><a href="/contact">Contact</a><div className="ml-auto"><ReadabilityControl value={1} onChange={() => {}} /></div>
        </div>
      </nav>
      <main className="pt-16 pb-6 min-h-[calc(100vh-4rem)]"><Page /><ContactBanner /></main>
    </div>
  </StaticRouter>);
}
