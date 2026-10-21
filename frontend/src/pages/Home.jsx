import React from 'react';
import { Link } from 'react-router-dom';
const logo = '/logo.png';

export default function Home() {


  return (
    <div className="landscape-page home-page">
      <div className="landscape-content">
      <header className="home-hero max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="reading-panel"><img src={logo} alt="Envirocentric Logo" className="home-logo"/><h1>Environmental Testing and Consulting</h1></div></header>
<div className="home-service-cta"><Link to="/contact#request-services" className="site-button">Request our services</Link></div><div className="home-sections max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Services Section */}
        <section aria-label="Environmental services" className="py-12 text-center reading-panel">
          <div className="home-service-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Link
              to="/services#asbestos"
              className="home-service-card bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center mb-4">
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
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">Lead</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Inspections, Risk Assessments, Clearances & Project Monitoring
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-300">
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
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">Microbial</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Inspections/Surveys & Clearances
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-300">
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
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">Hazardous Materials</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Assessments, Testing, Analysis & Disposal Consultation
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-300">
                <span>Learn More</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </section>
        {/* Company Info Section */}
        <section className="company-panel reading-panel text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              About Our Company
            </h2>
            <div className="space-y-5 text-left text-lg leading-relaxed text-gray-600 dark:text-gray-300">
              <p>
                Envirocentric is an environmental consulting firm with more than 30 years of experience in environmental testing and the abatement industry. Serving industrial, government, and residential customers throughout California, we help ensure that properties and facilities meet safety, health, and regulatory requirements.
              </p>
              <p>
                Our strength lies in our credentialed team of industry professionals. We hold state and federal certifications, operating as California Certified Asbestos Consultants, CDPH Lead Inspectors, CDPH Lead Risk Assessors, CDPH Lead Project Monitors, and Mold Inspectors and Supervisors. Whether you face complex environmental regulations, require hazardous material testing, or need oversight for a remediation project, we deliver the precise data and professional monitoring necessary to protect occupants and investments.
              </p>
              <p>
                We bridge the gap between rigorous technical consulting and hands-on environmental solutions. Our diverse capabilities allow us to manage projects from initial site inspection through construction and final clearance. Our NAICS classifications are:
              </p>
              <ul className="list-disc pl-10 space-y-1">
                <li><strong>541350:</strong> Building Inspection Services</li>
                <li><strong>541380:</strong> Testing Laboratories</li>
                <li><strong>541620:</strong> Environmental Consulting Services</li>
                <li><strong>236220:</strong> Commercial and Institutional Building Construction</li>
                <li><strong>238910:</strong> Site Preparation</li>
                <li><strong>238990:</strong> Specialty Trade Contracting</li>
              </ul>
              <p>
                At Envirocentric, we pride ourselves on safety, technical precision, and unwavering compliance with local, state, and federal regulations. We look forward to partnering with you to create safer, healthier environments across California.
              </p>
            </div>
          </div>
        </section>


      </div>
      </div>
    </div>
  );
}
