const labelFromLocation = (location = []) => {
  const parts = location.filter(part => part !== 'body').map(part => (
    typeof part === 'number' ? `row ${part + 1}` : String(part).replaceAll('_', ' ')
  ));
  return parts.join(' - ');
};

export const formatApiError = (error, fallback = 'Request failed') => {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    const messages = detail.map(item => {
      if (typeof item === 'string') return item;
      const field = labelFromLocation(item?.loc);
      const message = item?.msg || 'Invalid value';
      return field ? `${field}: ${message}` : message;
    }).filter(Boolean);
    return messages.length ? messages.join('\n') : fallback;
  }

  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object') {
    return detail.message || JSON.stringify(detail);
  }
  return error?.message || fallback;
};
