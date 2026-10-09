import React from 'react';
import PropTypes from 'prop-types';
export default function ServiceIcon({ type, className = 'w-12 h-12' }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'asbestos' && <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></>}
    {type === 'lead' && <text x="12" y="17" textAnchor="middle" fill="currentColor" stroke="none" fontSize="16" fontFamily="Arial, sans-serif" fontWeight="600">Pb</text>}
    {type === 'microbial' && <><ellipse cx="12" cy="10" rx="9" ry="6"/><path d="M3 10v4c0 3.3 4 6 9 6s9-2.7 9-6v-4"/><circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="11" r="2"/><path d="m13 6 .5.5m-7 6 .5.5"/></>}
    {type === 'hazardous-waste' && <>
      <path d="M12 2a6 6 0 0 0-6 6v2a4 4 0 0 0 3 3.87V16h6v-2.13A4 4 0 0 0 18 10V8a6 6 0 0 0-6-6Z"/>
      <g fill="currentColor" stroke="none">
        <ellipse cx="9" cy="9.5" rx="1.5" ry="1.75"/>
        <ellipse cx="15" cy="9.5" rx="1.5" ry="1.75"/>
        <path d="m12 11-1 2h2Z"/>
      </g>
      <path d="M11 14v2m2-2v2M4 18l16 4M4 22l16-4"/>
      <g fill="currentColor" stroke="none">
        <circle cx="3.5" cy="17.5" r="1"/><circle cx="3" cy="19" r="1"/>
        <circle cx="20.5" cy="21" r="1"/><circle cx="20" cy="22.5" r="1"/>
        <circle cx="3" cy="21" r="1"/><circle cx="3.5" cy="22.5" r="1"/>
        <circle cx="20" cy="17.5" r="1"/><circle cx="20.5" cy="19" r="1"/>
      </g>
    </>}

  </svg>;
}
ServiceIcon.propTypes = { type: PropTypes.string.isRequired, className: PropTypes.string };
