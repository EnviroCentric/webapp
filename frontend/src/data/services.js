export const serviceAnchor = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
export const serviceLabel = (name) => name.replace(/^(Asbestos|Lead) /, '');
export const services = [
    {
      id: 'asbestos',
      title: 'Asbestos Services',
      subtitle: 'Asbestos Management Solutions',
      description: 'Professional asbestos inspection, survey, and monitoring services to ensure workplace safety and regulatory compliance.',
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
          name: 'Asbestos Project Monitoring',
          description:
            'On-site oversight during asbestos abatement projects to help ensure proper procedures and regulatory compliance.',
          details: [
            'Pre-abatement setup inspection',
            'Daily monitoring during abatement',
            'Jobsite safety',
            'Workplace exposure monitoring',
            'Respirator fit testing',
            'Air sampling and analysis',
            'Final clearance inspection and certification',
          ],
        },
        {
          name: 'Asbestos Clearance Testing',
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
          name: 'Lead Risk Assessments',
          description: 'Evaluation of lead-based paint hazards and determination of risk reduction strategies.',
          details: [
            'Lead-based paint condition assessment',
            'Lead dust and soil sampling',
            'Drinking water testing',
            'Hazard identification and prioritization',
            'Risk reduction recommendations'
          ]
        },
        {
          name: 'Lead Clearance Testing',
          description: 'Post-renovation clearance testing.',
          details: [
            'Visual assessment',
            'Dust wipe sampling',
            'Soil sampling',
            'Clearance certification'
          ]
        },
        {
          name: 'Lead Project Monitoring',
          description: 'Oversight of lead abatement and renovation projects to ensure compliance with regulations.',
          details: [
            'Pre-abatement setup inspection',
            'Daily monitoring during abatement',
            'Jobsite safety',
            'Workplace exposure monitoring',
            'Respirator fit testing',
            'Air sampling and analysis',
            'Final clearance inspection and certification',
          ]
        }
      ]
    },
    {
      id: 'microbial',
      title: 'Microbial Services',
      subtitle: 'Mold & Indoor Air Quality Solutions',
      description: 'Professional mold inspection, assessment, and clearance services.',
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
      subtitle: 'Hazardous Waste Management & Compliance',
      description: 'Professional hazardous waste assessment, testing, and disposal consultation services.',
      services: [
        {
          name: 'Hazardous Waste Assessments',
          description: 'Comprehensive evaluation and characterization of potentially hazardous materials.',
          details: [
            'Hazardous waste determination',
            'Regulatory compliance assessment'
          ]
        },
        {
          name: 'Waste Testing & Analysis',
          description: 'Laboratory testing and analysis to determine waste characteristics and proper disposal methods.',
          details: [
            'TCLP testing for heavy metals',
            'Ignitability and reactivity testing',
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
