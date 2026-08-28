import { describe, expect, it, vi } from 'vitest';
import { downloadPdf } from './downloadPdf';

describe('downloadPdf', () => {
  it('uses the PDF filename supplied by the server', async () => {
    const api = {
      get: vi.fn().mockResolvedValue({
        data: new Blob(['%PDF-test'], { type: 'application/pdf' }),
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="916 Marcheta St - 07-12-2025.pdf"',
        },
      }),
    };
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') });
    Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    await downloadPdf(api, '/api/v1/reports/1/download', 'fallback.pdf');

    expect(api.get).toHaveBeenCalledWith('/api/v1/reports/1/download', { responseType: 'blob' });
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('rejects non-PDF responses', async () => {
    const api = {
      get: vi.fn().mockResolvedValue({
        data: new Blob(['error'], { type: 'application/json' }),
        headers: { 'content-type': 'application/json' },
      }),
    };
    await expect(downloadPdf(api, '/bad')).rejects.toThrow('did not return a PDF');
  });
});
