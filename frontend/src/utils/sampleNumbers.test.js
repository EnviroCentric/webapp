import { describe, expect, it } from 'vitest';
import { fillBlankSampleNumbers, incrementSampleNumber, nextSampleNumber } from './sampleNumbers';

describe('sample number helpers', () => {
  it('increments the final number and preserves zero padding', () => {
    expect(incrementSampleNumber('E-01')).toBe('E-02');
    expect(incrementSampleNumber('528108-04')).toBe('528108-05');
    expect(incrementSampleNumber('PCM009A')).toBe('PCM010A');
    expect(incrementSampleNumber('sample')).toBe('');
  });

  it('increments regular and blank sequences independently', () => {
    const samples = [
      { sample_number: 'A-08', is_blank: false },
      { sample_number: 'A-09', is_blank: false },
      { sample_number: 'A-10', is_blank: true },
    ];
    expect(nextSampleNumber(samples, false)).toBe('A-10');
    expect(nextSampleNumber(samples, true)).toBe('A-11');
  });

  it('numbers empty required blanks after the final regular sample', () => {
    const result = fillBlankSampleNumbers([
      { sample_number: '25322-08', is_blank: false },
      { sample_number: '25322-09', is_blank: false },
      { sample_number: '', is_blank: true },
      { sample_number: '', is_blank: true },
    ]);
    expect(result.map(sample => sample.sample_number)).toEqual([
      '25322-08', '25322-09', '25322-10', '25322-11',
    ]);
  });
});
