import { toTitleCase } from './textUtils';

export const getStreetOnly = (formattedAddress) => {
  if (!formattedAddress) return '';
  return String(formattedAddress).split(',')[0].trim();
};

export const hasStreetNumber = (value) => {
  return /^\s*\d+[A-Za-z]?\b/.test(String(value || ''));
};

export const normalizeReportAddress = (address = {}, streetNumber = '') => {
  const formattedAddress = String(address?.formatted_address || '').trim();
  const addressLine1 = String(address?.address_line1 || '').trim();
  const street = getStreetOnly(formattedAddress);
  const manualStreetNumber = String(streetNumber || '').trim();

  if (addressLine1 && hasStreetNumber(addressLine1) && !hasStreetNumber(street)) {
    const rest = formattedAddress
      .split(',')
      .slice(1)
      .map((part) => part.trim())
      .filter(Boolean);
    return [addressLine1, ...rest].join(', ');
  }

  if (manualStreetNumber && street && !hasStreetNumber(street)) {
    const rest = formattedAddress
      .split(',')
      .slice(1)
      .map((part) => part.trim())
      .filter(Boolean);
    return [`${manualStreetNumber} ${street}`, ...rest].join(', ');
  }

  return formattedAddress;
};

export const formatShortDate = (dateString) => {
  if (!dateString) return '';

  // Prefer explicit short date formatting (MM/DD/YY).
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';

    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  } catch {
    return '';
  }
};

export const getReportKindLabel = (reportKind) => {
  const k = String(reportKind || '').toLowerCase();
  if (!k) return '';
  if (k === 'area') return 'Area';
  if (k === 'clearance') return 'Clearance';
  if (k === 'personal') return 'Personal';
  return k;
};

export const getReportTitle = (report) => {
  const street = getStreetOnly(report?.formatted_address);
  const d = formatShortDate(report?.report_date || report?.generated_at);
  return [street, d].filter(Boolean).join(' ').trim() || (report?.report_name || 'Report');
};

export const getReportDownloadFilename = (report) => {
  const street = getStreetOnly(report?.formatted_address) || (report?.report_name || 'report');
  const d = formatShortDate(report?.report_date || report?.generated_at).replaceAll('/', '-');
  const base = [street, d].filter(Boolean).join(' ').trim();
  return base.replace(/[^a-z0-9 _.-]/gi, '_');
};

export const getTechnicianDisplayName = (report) => {
  const v = report?.technician_user_name || report?.technician_name || '';
  return toTitleCase(String(v || '').trim());
};

export const getUploaderDisplayName = (report) => {
  const v = report?.generated_by_name || '';
  return toTitleCase(String(v || '').trim());
};
