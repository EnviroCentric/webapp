import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import ServiceIcon from '../components/ServiceIcon';
import ContactBanner from '../components/ContactBanner';

export default function Home() {


  return (
    <div className="landscape-page home-page">
      <div className="landscape-content">
      <header className="home-hero"><div className="reading-panel"><img src={logo} alt="Enviro-Centric Logo" className="home-logo"/><h1>Environmental Testing and Consulting</h1><Link to="/contact#request-services" className="site-button">Request our services</Link></div></header>
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Services Section */}
        <section className="py-12 text-center reading-panel">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8">
            Environmental Testing and Consulting
          </h2>
          <div className="home-service-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Link
              to="/services#asbestos"
              className="home-service-card bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <ServiceIcon type="asbestos" className="w-8 h-8 mr-3 text-blue-600 dark:text-blue-400"/>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">Asbestos</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Inspections/Surveys, Clearances & Project Monitoring
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-300">
                <span>Learn More</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
            <Link
              to="/services#lead"
              className="home-service-card bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <ServiceIcon type="lead" className="w-8 h-8 mr-3 text-green-600 dark:text-green-400"/>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300">Lead</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Inspections, Risk Assessments, Clearances & Project Monitoring
              </p>
              <div className="flex items-center text-green-600 dark:text-green-400 font-medium group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors duration-300">
                <span>Learn More</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
            <Link
              to="/services#microbial"
              className="home-service-card bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <ServiceIcon type="microbial" className="w-8 h-8 mr-3 text-purple-600 dark:text-purple-400"/>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors duration-300">Microbial</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Inspections/Surveys & Clearances
              </p>
              <div className="flex items-center text-purple-600 dark:text-purple-400 font-medium group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors duration-300">
                <span>Learn More</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
            <Link
              to="/services#hazardous-waste"
              className="home-service-card bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <ServiceIcon type="hazardous-waste" className="w-8 h-8 mr-3 text-orange-600 dark:text-orange-400"/>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-300">Hazardous Materials</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Assessments, Testing, Analysis & Disposal Consultation
              </p>
              <div className="flex items-center text-orange-600 dark:text-orange-400 font-medium group-hover:text-orange-700 dark:group-hover:text-orange-300 transition-colors duration-300">
                <span>Learn More</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </section>
        {/* Company Info Section */}
        <section className="company-panel py-12 text-center rounded-lg mb-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              About Our Company
            </h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Service Areas</h3>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  Serving all of California
                </p>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Certifications</h3>
                <ul className="text-lg text-gray-600 dark:text-gray-300 space-y-2">
                  <li>CA Certified Abestos Consultants</li>
                  <li>CDPH Lead Inspectors</li>
                  <li>CDPH Risk Assessors</li>
                  <li>CDPH Project Monitors</li>
                </ul>
              </div>
              {/* Credentials Section

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Credentials
                </h3> */}
                <div className="flex flex-col space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">NAICS Codes</h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      236220, 238320, 238910,<br />
                      238990, 541350, 541380,<br />
                      54162
                    </p>
                  </div>
                </div>

            </div>
          </div>
        </section>

      </div>
      <ContactBanner/>
      </div>
    </div>
  );
}
