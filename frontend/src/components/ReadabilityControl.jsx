import PropTypes from 'prop-types';

export default function ReadabilityControl({ value, onChange }) {
  const dark = value === 3;
  return <button type="button" className="readability-control" role="switch"
    aria-label="Dark text boxes" aria-checked={dark}
    title={dark ? 'Switch to clear glass text boxes' : 'Switch to dark text boxes'}
    onClick={() => onChange(dark ? 2 : 3)}>
    <span className="readability-label" aria-hidden="true">Readability</span>
    <span className="readability-switch-track" aria-hidden="true"><span className="readability-switch-thumb" /></span>
  </button>;
}
ReadabilityControl.propTypes = { value: PropTypes.oneOf([2, 3]).isRequired, onChange: PropTypes.func.isRequired };
