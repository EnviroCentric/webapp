import { describe, expect, it } from 'vitest';
import { formatApiError } from './apiErrors';

describe('formatApiError', () => {
  it('formats FastAPI validation arrays as readable text', () => {
    const error = {
      response: {
        data: {
          detail: [
            { loc: ['body', 'samples', 0, 'description'], msg: 'Field required' },
            { loc: ['body', 'technician_name'], msg: 'String should have at least 1 character' },
          ],
        },
      },
    };

    expect(formatApiError(error)).toBe(
      'samples - row 1 - description: Field required\n'
      + 'technician name: String should have at least 1 character',
    );
  });

  it('preserves string details and falls back safely', () => {
    expect(formatApiError({ response: { data: { detail: 'Project not found' } } })).toBe('Project not found');
    expect(formatApiError({}, 'Unable to save')).toBe('Unable to save');
  });
});
