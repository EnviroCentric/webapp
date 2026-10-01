export const COUNT_HELPER_STORAGE_KEY = 'enviro-count-helper:v1';
export const FIELD_COUNT = 100;

export function createCountState() {
  return {
    version: 1,
    fields: Array(FIELD_COUNT).fill(null),
    currentField: 0,
    completedFields: 0,
    status: 'active',
  };
}

export function totalFibers(state) {
  return state.fields.reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
}

export function changeCurrentCount(state, amount) {
  if (state.status !== 'active') return state;

  const fields = [...state.fields];
  const current = fields[state.currentField] ?? 0;
  const next = Math.max(0, current + amount);
  if (next === current && fields[state.currentField] === null) return state;
  fields[state.currentField] = next;
  const updated = { ...state, fields };

  return totalFibers(updated) >= 100
    ? {
        ...updated,
        completedFields: Math.max(state.completedFields, state.currentField + 1),
        status: 'overloaded',
      }
    : updated;
}

export function moveToPreviousField(state) {
  if (state.status !== 'active' || state.currentField === 0) return state;
  return { ...state, currentField: state.currentField - 1 };
}

export function finalizeAndAdvance(state) {
  if (state.status !== 'active') return state;

  const fields = [...state.fields];
  if (fields[state.currentField] === null) fields[state.currentField] = 0;
  const completedFields = Math.max(state.completedFields, state.currentField + 1);

  if (state.currentField === FIELD_COUNT - 1) {
    return { ...state, fields, completedFields: FIELD_COUNT, status: 'complete' };
  }

  return {
    ...state,
    fields,
    completedFields,
    currentField: state.currentField + 1,
  };
}

export function restoreCountState(rawValue) {
  if (!rawValue) return createCountState();

  try {
    const value = JSON.parse(rawValue);
    const validFields = Array.isArray(value.fields)
      && value.fields.length === FIELD_COUNT
      && value.fields.every((field) => field === null || (typeof field === 'number' && field >= 0));
    const validStatus = ['active', 'overloaded', 'complete'].includes(value.status);
    const validPosition = Number.isInteger(value.currentField)
      && value.currentField >= 0 && value.currentField < FIELD_COUNT;
    const validCompleted = Number.isInteger(value.completedFields)
      && value.completedFields >= 0 && value.completedFields <= FIELD_COUNT;

    if (value.version !== 1 || !validFields || !validStatus || !validPosition || !validCompleted) {
      return createCountState();
    }
    return value;
  } catch {
    return createCountState();
  }
}

export function serializeCountCsv(state) {
  const rows = [
    ['Total Fibers', totalFibers(state)],
    ['Total Fields', state.completedFields],
    [],
    ['Row', ...Array.from({ length: 10 }, (_, index) => `Column ${index + 1}`)],
  ];

  for (let row = 0; row < 10; row += 1) {
    rows.push([
      `Row ${row + 1}`,
      ...state.fields.slice(row * 10, row * 10 + 10).map((value, column) => {
        const fieldIndex = row * 10 + column;
        return fieldIndex < state.completedFields || value !== null ? (value ?? 0) : '';
      }),
    ]);
  }

  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
}

export function countCsvFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `count-helper-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.csv`;
}

export function normalizeCsvFilename(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/[. ]+$/g, '');
  const filename = cleaned || 'count-helper';
  return filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
}
