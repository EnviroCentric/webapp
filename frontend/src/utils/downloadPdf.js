const filenameFromDisposition = (value) => {
  if (!value) return '';
  const utf = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf) return decodeURIComponent(utf[1].replace(/["']/g, ''));
  const plain = value.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() || '';
};

export async function downloadPdf(api, url, fallbackFilename = 'report.pdf') {
  const response = await api.get(url, { responseType: 'blob' });
  const contentType = String(response.headers?.['content-type'] || response.data?.type || '');
  if (contentType && !contentType.toLowerCase().includes('application/pdf')) {
    throw new Error('The server did not return a PDF');
  }
  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: 'application/pdf' });
  if (!blob.size) throw new Error('The PDF response was empty');
  const filename = filenameFromDisposition(response.headers?.['content-disposition'])
    || (fallbackFilename.toLowerCase().endsWith('.pdf') ? fallbackFilename : `${fallbackFilename}.pdf`);
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}
