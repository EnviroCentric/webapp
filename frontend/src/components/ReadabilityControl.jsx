import PropTypes from 'prop-types';

export default function ReadabilityControl({ checked, onToggle }) {
  return <button type="button" className="text-box-toggle" role="switch"
    aria-label="Readability backgrounds" aria-checked={checked} onClick={onToggle}>
    <span>Readability</span>
    <span className="text-box-switch-track" aria-hidden="true"><span className="text-box-switch-thumb" /></span>
  </button>;
}
ReadabilityControl.propTypes = { checked: PropTypes.bool.isRequired, onToggle: PropTypes.func.isRequired };