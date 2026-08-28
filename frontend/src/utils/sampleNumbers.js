export const incrementSampleNumber = (value) => {
  const sampleNumber = String(value || '').trim();
  if (!sampleNumber) return '';
  const match = sampleNumber.match(/(\d+)(?=\D*$)/);
  if (!match) return '';
  const next = String(Number(match[1]) + 1).padStart(match[1].length, '0');
  return sampleNumber.replace(match[1], next);
};

export const nextSampleNumber = (samples, isBlank = false) => {
  const sameKind = (samples || []).filter(sample => (
    Boolean(sample.is_blank) === isBlank && sample.sample_number?.trim()
  ));
  const regular = (samples || []).filter(sample => !sample.is_blank && sample.sample_number?.trim());
  const source = sameKind.at(-1) || (isBlank ? regular.at(-1) : null);
  return incrementSampleNumber(source?.sample_number);
};

export const fillBlankSampleNumbers = (samples) => {
  let previous = (samples || []).filter(sample => !sample.is_blank && sample.sample_number?.trim()).at(-1)?.sample_number || '';
  return (samples || []).map(sample => {
    if (!sample.is_blank) return sample;
    if (sample.sample_number?.trim()) {
      previous = sample.sample_number;
      return sample;
    }
    const sampleNumber = incrementSampleNumber(previous);
    if (sampleNumber) previous = sampleNumber;
    return { ...sample, sample_number: sampleNumber };
  });
};
