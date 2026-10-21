import PropTypes from 'prop-types';

const options = [
  { value: 1, label: 'No text boxes' },
  { value: 2, label: 'Crystal glass text boxes' },
  { value: 3, label: 'Dark text boxes' },
];

export default function ReadabilityControl({ value, onChange }) {
  return <div className="readability-control">
    <span className="readability-label" aria-hidden="true">Readability</span>
    <div className="readability-options" role="group" aria-label="Readability mode">
      {options.map(option => <button type="button" key={option.value}
        aria-label={`${option.value}: ${option.label}`} title={option.label}
        aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.value}</button>)}
    </div>
  </div>;
}
ReadabilityControl.propTypes = { value: PropTypes.oneOf([1, 2, 3]).isRequired, onChange: PropTypes.func.isRequired };
