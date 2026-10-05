import React from 'react';
import PropTypes from 'prop-types';
export default function ServiceIcon({ type, className = 'w-12 h-12' }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'asbestos' && <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></>}
    {type === 'lead' && <g strokeWidth=".8" strokeLinejoin="miter">
      <path d="M2 3h3v3H2zM19 3h3v3h-3zM2 6h3v3H2zM5 6h3v3H5zM14 6h3v3h-3zM17 6h2v3h-2zM19 6h3v3h-3zM2 9h3v3H2zM5 9h3v3H5zM14 9h3v3h-3zM17 9h2v3h-2zM19 9h3v3h-3z"/>
      <path d="M2 12h20v6H2zM2 15h20M5 12v6m3-6v6m3-6v6m3-6v6m3-6v6m2-6v6M5 20h14v2H5zM8 20v2m3-2v2m3-2v2m3-2v2"/>
    </g>}
    {type === 'microbial' && <><ellipse cx="12" cy="10" rx="9" ry="6"/><path d="M3 10v4c0 3.3 4 6 9 6s9-2.7 9-6v-4"/><circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="11" r="2"/><path d="m13 6 .5.5m-7 6 .5.5"/></>}
    {type === 'hazardous-waste' && <>
      <path d="M6 9a6 6 0 1 1 12 0v2c0 2-1.5 3-3 3.5V17H9v-2.5C7.5 14 6 13 6 11V9Z"/>
      <path d="M8 9.5 10.5 11 8 12Z M16 9.5 13.5 11 16 12Z" fill="currentColor" stroke="none"/>
      <path d="m11 14 1-2 1 2m-2 1v2m2-2v2"/>
      <path d="m5 18 14 4M5 22l14-4M3 17l2 1-1 2m16-3-1 1 2 1M3 21l2 1-1 1m16-2-1 1 2 1"/>
    </>}

  </svg>;
}
ServiceIcon.propTypes = { type: PropTypes.string.isRequired, className: PropTypes.string };
