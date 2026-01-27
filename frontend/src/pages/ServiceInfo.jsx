import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ServiceInfo() {
  const location = useLocation();

  // Scroll to section based on hash in URL
  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.substring(1));
      if (element) {
        // Add a small delay to ensure page is fully rendered
        setTimeout(() => {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }, 100);
      }
    }
  }, [location]);

  const services = [
    {
      id: 'asbestos',
      title: 'Asbestos Services',
      subtitle: 'Comprehensive Asbestos Management Solutions',
      description: 'Professional asbestos inspection, survey, and monitoring services to ensure workplace safety and regulatory compliance.',
      icon: (
        <svg className="w-16 h-16 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      services: [
        {
          name: 'Asbestos Inspections & Surveys',
          description:
            'Combined inspections and surveys to identify and assess asbestos-containing materials (ACMs) for ongoing management, renovation, or demolition projects.',
          details: [
            'Visual assessment of accessible areas',
            'Bulk sampling',
            'Management surveys for occupied buildings',
            'Renovation/demolition surveys',
            'AHERA inspection and re-inspection surveys',
            'Detailed photographic documentation',
            'Comprehensive written reports with risk evaluation and recommendations',
          ],
        },
        {
          name: 'Project Monitoring',
          description:
            'On-site oversight during asbestos abatement projects to help ensure proper procedures and regulatory compliance.',
          details: [
            'Pre-abatement setup inspection',
            'Daily monitoring during abatement',
            'Air sampling and analysis',
            'Final clearance inspection and certification',
          ],
        },
        {
          name: 'Clearance Testing',
          description:
            'Post-abatement clearance inspections following asbestos removal work.',
          details: [
            'Visual inspection of work area',
            'Air sampling and analysis',
            'Surface sampling when required',
            'Clearance certification documentation',
          ],
        },
      ]
    },
    {
      id: 'lead',
      title: 'Lead Services',
      subtitle: 'Lead-Based Paint Assessment & Management',
      description: 'Expert lead inspection, risk assessment, and monitoring services for residential and commercial buildings.',
      icon: (
        <svg className="w-16 h-16 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      services: [
        {
          name: 'Lead Inspections',
          description: 'Systematic inspection to determine the presence of lead-based paint in residential and commercial buildings.',
          details: [
            'XRF testing of painted surfaces',
            'Paint chip sampling',
            'Documentation of Identified lead-based paint locations',
            'Comprehensive inspection reports'
          ]
        },
        {
          name: 'Risk Assessments',
          description: 'Evaluation of lead-based paint hazards and determination of risk reduction strategies.',
          details: [
            'Lead-based paint condition assessment',
            'Lead dust and soil sampling',
            'Hazard identification and prioritization',
            'Risk reduction recommendations'
          ]
        },
        {
          name: 'Clearance Testing',
          description: 'Post-renovation clearance testing.',
          details: [
            'Visual assessment',
            'Dust wipe sampling',
            'Soil sampling',
            'Clearance certification'
          ]
        },
        {
          name: 'Project Monitoring',
          description: 'Oversight of lead abatement and renovation projects to ensure compliance with regulations.',
          details: [
            'Pre-work setup inspection',
            'Daily monitoring during work',
            'Work practice evaluation',
            'Final clearance inspection and certification'
          ]
        }
      ]
    },
    {
      id: 'microbial',
      title: 'Microbial Services',
      subtitle: 'Mold & Indoor Air Quality Solutions',
      description: 'Professional mold inspection, assessment, and clearance services.',
      icon: (
        <svg className="w-16 h-16 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      services: [
        {
          name: 'Mold Inspections',
          description: 'Comprehensive visual inspections to identify mold growth and moisture instrusion in residential and commercial buildings.',
          details: [
            'Visual inspection of accessible areas',
            'Moisture detection and measurement',
            'Air and surface sampling',
            'Detailed inspection reports with recommendations',
          ]
        },
        {
          name: 'Indoor Air Quality Surveys',
          description: 'Assessment of indoor air quality conditions.',
          details: [
            'Air sampling for mold spores',
            'Particle counting and analysis',
            'VOC (Volatile Organic Compounds) testing',
            'Comprehensive air quality reports'
          ]
        },
        {
          name: 'Clearance Testing',
          description: 'Post-remediation clearance inspections following mold removal work.',
          details: [
            'Visual inspection of remediated areas',
            'Post-remediation air sampling',
            'Surface sampling verification',
            'Clearance certification documentation'
          ]
        },
        {
          name: 'Moisture Assessments',
          description: 'Identification and evaluation of moisture sources that can lead to mold growth.',
          details: [
            'Moisture meter readings',
            'Thermal imaging inspection',
            'Humidity level monitoring',
            'PotentiaL Water intrusion source identification'
          ]
        }
      ]
    },
    {
      id: 'hazardous-waste',
      title: 'Hazardous Waste Services',
      subtitle: 'Hazardous Materials Management & Compliance',
      description: 'Professional hazardous waste assessment, testing, and disposal consultation services.',
      icon: (
        <svg className="w-16 h-16 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      services: [
        {
          name: 'Hazardous Waste Assessments',
          description: 'Comprehensive evaluation and characterization of potentially hazardous materials.',
          details: [
            'Material identification and classification',
            'Hazardous waste determination',
            'Generator status evaluation',
            'Regulatory compliance assessment'
          ]
        },
        {
          name: 'Waste Testing & Analysis',
          description: 'Laboratory testing and analysis to determine waste characteristics and proper disposal methods.',
          details: [
            'TCLP testing for heavy metals',
            'Ignitability and reactivity testing',
            'Paint filter test',
            'Chemical composition analysis'
          ]
        },
        {
          name: 'Disposal Consultation',
          description: 'Expert guidance on proper disposal methods and regulatory requirements.',
          details: [
            'Disposal option recommendations',
            'Waste manifesting assistance',
            'Transportation requirements',
            'Cost-effective disposal solutions'
          ]
        },
        {
          name: 'Regulatory Compliance',
          description: 'Ensure compliance with federal and state hazardous waste regulations.',
          details: [
            'RCRA compliance guidance',
            'Waste accumulation requirements',
            'Training and documentation support',
            'Reporting and recordkeeping assistance'
          ]
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-300 dark:bg-gray-900 pt-16">
      {/* Hero Section */}
      <div
        className="relative text-white"
        style={{
          backgroundImage: "url('/sequoia.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="bg-gray-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Our Services
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
              Comprehensive environmental consulting services for asbestos, lead, and microbial assessments
            </p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {services.map((service, index) => (
          <section
            key={service.id}
            id={service.id}
            className={`${index > 0 ? 'mt-20' : ''} scroll-mt-20`}
          >
            {/* Service Header */}
            <div className="text-center mb-12">
              <div className="flex justify-center mb-6">
                {service.icon}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                {service.title}
              </h2>
              <h3 className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-6">
                {service.subtitle}
              </h3>
              <p className="text-lg text-gray-700 dark:text-gray-300 max-w-4xl mx-auto">
                {service.description}
              </p>
            </div>

            {/* Service Details Grid */}
            <div className={`grid gap-8 items-center ${
              service.services.length === 3 
                ? 'lg:grid-cols-[1fr_minmax(400px,550px)] lg:grid-rows-2 lg:[&>*:first-child]:row-span-2'
                : 'grid-cols-1 lg:grid-cols-2'
            }`}>
              {service.services.map((subService) => (
                <div
                  key={subService.name}
                  className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300 ${
                    service.services.length === 3 ? 'h-fit' : 'h-full'
                  }`}
                >
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {subService.name}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {subService.description}
                  </p>
                  <ul className="space-y-2">
                    {subService.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex items-start">
                        <svg
                          className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-gray-600 dark:text-gray-300">
                          {detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Divider */}
            {index < services.length - 1 && (
              <div className="mt-16 border-b border-gray-200 dark:border-gray-700"></div>
            )}
          </section>
        ))}
      </div>

      {/* Call to Action */}
      <div className="bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Need Environmental Consulting Services?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Contact our experienced team for professional environmental assessments and consulting services.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="tel:(714) 335-5973"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-300"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call (714) 335-5973
              </a>
              <a
                href="mailto:info@enviro-centric.com"
                className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}