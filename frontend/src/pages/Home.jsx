import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function Home() {


  return (
    <div className="min-h-screen bg-gray-300 dark:bg-gray-900 transition-colors duration-200">
      {/* Large Logo Section with Background */}
      <div 
        className="relative flex justify-center items-center min-h-[40vh] sm:min-h-[45vh] lg:min-h-[50vh] py-8"
        style={{
          backgroundImage: "url('/sequoia.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gray-900/70"></div>
        <img 
          src={logo} 
          alt="Enviro-Centric Logo" 
          className="relative z-10 max-w-[85vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl h-auto"
          loading="eager"
          decoding="async"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Services Section */}
        <section className="py-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8">
            Our Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Link 
              to="/services#asbestos"
              className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
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
              className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
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
              className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center mb-4">
                <svg className="w-8 h-8 text-purple-600 dark:text-purple-400 mr-3 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
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
          </div>
        </section>

        {/* Company Info Section */}
        <section className="py-12 text-center bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
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
              {/* Credentials Section */}
              
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Credentials
                </h3>
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
    </div>
  );
} 