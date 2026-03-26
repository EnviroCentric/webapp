import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  formatShortDate,
  getReportKindLabel,
  getReportTitle,
  getTechnicianDisplayName,
  getUploaderDisplayName,
} from '../utils/reportUtils';

export default function ReportDetails() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [report, setReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userRoleLevel = Math.max(...(user?.roles?.map(role => role.level) || [0]));
  const isTechnicianOrHigher = userRoleLevel >= 50;

  useEffect(() => {
    if (!isTechnicianOrHigher) {
      navigate('/dashboard', { replace: true });
      return;
    }

    let cancelled = false;
    let objectUrl = '';

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const metaResp = await api.get(`/api/v1/reports/${reportId}`);
        if (cancelled) return;

        setReport(metaResp.data);

        const pdfResp = await api.get(`/api/v1/reports/${reportId}/download`, {
          responseType: 'blob',
        });
        if (cancelled) return;

        const blob = new Blob([pdfResp.data], { type: 'application/pdf' });
        objectUrl = window.URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err) {
        console.error('Error loading report details:', err);
        if (!cancelled) setError('Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (objectUrl) {
        try {
          window.URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [isTechnicianOrHigher, navigate, reportId]);

  const title = useMemo(() => getReportTitle(report), [report]);
  const kindLabel = useMemo(() => getReportKindLabel(report?.report_kind), [report]);

  const uploader = useMemo(() => getUploaderDisplayName(report), [report]);
  const technician = useMemo(() => getTechnicianDisplayName(report), [report]);

  const dateLabel = useMemo(
    () => formatShortDate(report?.report_date || report?.generated_at),
    [report]
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => {
            if (report?.project_id) {
              navigate(`/projects/${report.project_id}/reports`);
              return;
            }
            navigate(-1);
          }}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back
        </button>

        {report?.project_id && (
          <button
            type="button"
            onClick={() => navigate(`/projects/${report.project_id}`)}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Open Project
          </button>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {kindLabel && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {kindLabel}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {report?.formatted_address || ''}
          {report?.location_label ? ` (${report.location_label})` : ''}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="w-full" style={{ height: '75vh' }}>
          {pdfUrl ? (
            <iframe
              title="Report PDF"
              src={pdfUrl}
              className="w-full h-full"
            />
          ) : (
            <div className="p-6 text-gray-600 dark:text-gray-300">PDF preview unavailable.</div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Uploaded by</div>
              <div className="text-gray-900 dark:text-gray-100">{uploader || '—'}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Technician</div>
              <div className="text-gray-900 dark:text-gray-100">{technician || '—'}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Report date</div>
              <div className="text-gray-900 dark:text-gray-100">{dateLabel || '—'}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Type</div>
              <div className="text-gray-900 dark:text-gray-100">{kindLabel || '—'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-gray-500 dark:text-gray-400">Notes</div>
              <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{report?.notes || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
