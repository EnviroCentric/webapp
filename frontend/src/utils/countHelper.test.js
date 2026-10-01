import { describe, expect, it } from 'vitest';
import {
  changeCurrentCount,
  countCsvFilename,
  createCountState,
  finalizeAndAdvance,
  moveToPreviousField,
  normalizeCsvFilename,
  restoreCountState,
  serializeCountCsv,
  totalFibers,
} from './countHelper';

describe('count helper rules', () => {
  it('supports fractional changes and clamps subtraction at zero', () => {
    let state = createCountState();
    state = changeCurrentCount(state, 0.5);
    state = changeCurrentCount(state, 1);
    expect(totalFibers(state)).toBe(1.5);

    state = changeCurrentCount(state, -1);
    state = changeCurrentCount(state, -1);
    expect(totalFibers(state)).toBe(0);
  });

  it('finalizes a zero field and does not double count when revisiting it', () => {
    let state = finalizeAndAdvance(createCountState());
    expect(state.fields[0]).toBe(0);
    expect(state.completedFields).toBe(1);

    state = moveToPreviousField(state);
    state = finalizeAndAdvance(state);
    expect(state.completedFields).toBe(1);
    expect(state.currentField).toBe(1);
  });

  it('locks as overloaded at 100 or more fibers regardless of field count', () => {
    const nearLimit = { ...createCountState(), fields: [99.5, ...Array(99).fill(null)] };
    const overloaded = changeCurrentCount(nearLimit, 1);
    expect(totalFibers(overloaded)).toBe(100.5);
    expect(overloaded.status).toBe('overloaded');
    expect(overloaded.completedFields).toBe(1);
    expect(changeCurrentCount(overloaded, -1)).toBe(overloaded);
  });

  it('continues after 20 fields but completes when field 100 is finalized', () => {
    let state = createCountState();
    for (let index = 0; index < 20; index += 1) state = finalizeAndAdvance(state);
    expect(state.completedFields).toBe(20);
    expect(state.status).toBe('active');

    state = { ...state, currentField: 99, completedFields: 99 };
    state = finalizeAndAdvance(state);
    expect(state.completedFields).toBe(100);
    expect(state.status).toBe('complete');
  });
});

describe('count helper persistence and CSV', () => {
  it('restores valid state and rejects malformed or stale state', () => {
    const state = finalizeAndAdvance(createCountState());
    expect(restoreCountState(JSON.stringify(state))).toEqual(state);
    expect(restoreCountState('{broken')).toEqual(createCountState());
    expect(restoreCountState(JSON.stringify({ ...state, version: 2 }))).toEqual(createCountState());
  });

  it('exports summaries and a labeled 10 by 10 matrix with blanks and completed zeros', () => {
    const state = finalizeAndAdvance(createCountState());
    const rows = serializeCountCsv(state).split('\r\n');
    expect(rows).toHaveLength(14);
    expect(rows[0]).toBe('"Total Fibers","0"');
    expect(rows[1]).toBe('"Total Fields","1"');
    expect(rows[3]).toContain('"Column 10"');
    expect(rows[4]).toBe('"Row 1","0","","","","","","","","",""');
    expect(rows[13].startsWith('"Row 10"')).toBe(true);
  });

  it('creates a timestamped CSV filename in local time', () => {
    expect(countCsvFilename(new Date(2026, 7, 28, 14, 30, 0)))
      .toBe('count-helper-2026-08-28-143000.csv');
  });

  it('normalizes a user-entered CSV filename', () => {
    expect(normalizeCsvFilename('My fiber count')).toBe('My fiber count.csv');
    expect(normalizeCsvFilename('sample.CSV')).toBe('sample.CSV');
    expect(normalizeCsvFilename('bad/name?.csv')).toBe('bad-name-.csv');
    expect(normalizeCsvFilename('   ')).toBe('count-helper.csv');
  });
});
