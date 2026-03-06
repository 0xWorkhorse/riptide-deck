'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

const FORMAT_OPTIONS = [
  { value: 'csv', icon: FileText, label: 'CSV' },
  { value: 'xlsx', icon: FileSpreadsheet, label: 'Excel (XLSX)' },
  { value: 'json', icon: FileJson, label: 'JSON' },
];

const STATUS_OPTIONS = ['matched', 'modified', 'added', 'removed'];

export default function ExportDialog({ comparisonId, onClose }) {
  const t = useTranslations('export');
  const tExc = useTranslations('exceptions');
  const tCommon = useTranslations('common');

  const [format, setFormat] = useState('csv');
  const [includeStatuses, setIncludeStatuses] = useState([
    'modified',
    'added',
    'removed',
  ]);
  const [enriched, setEnriched] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);

  const toggleStatus = (status) => {
    setIncludeStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparisonId,
          format,
          includeStatuses,
          enriched,
        }),
      });
      if (!res.ok) throw new Error('Export failed');

      // If the API returns a download URL
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await res.json();
        if (data.url) {
          setDownloadUrl(data.url);
        } else if (data.data) {
          // Create a blob download
          const blob = new Blob([JSON.stringify(data.data, null, 2)], {
            type: 'application/json',
          });
          setDownloadUrl(URL.createObjectURL(blob));
        }
      } else {
        // Direct file download
        const blob = await res.blob();
        const ext = format === 'xlsx' ? 'xlsx' : format === 'json' ? 'json' : 'csv';
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    const ext = format === 'xlsx' ? 'xlsx' : format === 'json' ? 'json' : 'csv';
    a.download = `export-${comparisonId}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card mx-4 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="btn-ghost !p-2 text-text-muted hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Format selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-text-secondary">
              {t('format')}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`card card-hover flex flex-col items-center gap-2 p-4 transition-all ${
                      isSelected
                        ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-500/5'
                        : ''
                    }`}
                  >
                    <Icon
                      className={`h-6 w-6 ${
                        isSelected ? 'text-brand-400' : 'text-text-muted'
                      }`}
                    />
                    <span
                      className={`text-xs font-medium ${
                        isSelected ? 'text-brand-400' : 'text-text-secondary'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status filter */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-text-secondary">
              Include Statuses
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => {
                const isSelected = includeStatuses.includes(status);
                return (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={`badge cursor-pointer transition-all ${
                      isSelected
                        ? `badge-${status}`
                        : 'bg-surface-2 text-text-muted'
                    }`}
                  >
                    {tExc(`status.${status}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Include enrichments toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enriched}
              onChange={(e) => setEnriched(e.target.checked)}
              className="h-4 w-4 rounded border-border-default bg-surface-2 accent-brand-500"
            />
            <span className="text-sm text-text-primary">
              {t('enrichment.includeMatched')}
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-status-removed/10 px-4 py-3 text-sm text-status-removed">
              {error}
            </div>
          )}

          {/* Download ready */}
          {downloadUrl && (
            <div className="flex items-center gap-2 rounded-lg bg-status-matched/10 px-4 py-3 text-sm text-status-matched">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {t('downloadReady')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
          <button onClick={onClose} className="btn-ghost">
            {tCommon('close')}
          </button>
          {downloadUrl ? (
            <button
              onClick={handleDownload}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {t('download')}
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating || includeStatuses.length === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-40"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('generating')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t('generate')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
