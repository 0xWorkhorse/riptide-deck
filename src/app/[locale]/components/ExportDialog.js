'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Download, Loader2 } from 'lucide-react';

export default function ExportDialog({ comparisonId, onClose }) {
  const t = useTranslations('export');
  const tCommon = useTranslations('common');

  const [format, setFormat] = useState('csv');
  const [includeMatched, setIncludeMatched] = useState(true);
  const [enriched, setEnriched] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function handleExport() {
    setGenerating(true);
    const includeStatuses = ['modified', 'added', 'removed'];
    if (includeMatched) includeStatuses.push('matched');

    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comparisonId, format, includeStatuses, enriched }),
    });

    if (format === 'json') {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `comparison-${comparisonId}.json`);
    } else {
      const blob = await res.blob();
      const ext = format === 'xlsx' ? 'xlsx' : 'csv';
      downloadBlob(blob, `comparison-${comparisonId}.${ext}`);
    }

    setGenerating(false);
    onClose();
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="card w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{t('title')}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-text-secondary">{t('format')}</label>
          <div className="grid grid-cols-3 gap-2">
            {['csv', 'xlsx', 'json'].map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  format === f
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                    : 'border-border-default bg-surface-2 text-text-secondary hover:border-brand-500/50'
                }`}
              >
                {t(`formats.${f}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-text-secondary">{t('enrichment.title')}</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeMatched}
              onChange={(e) => setIncludeMatched(e.target.checked)}
              className="rounded border-border-default"
            />
            <span className="text-sm text-text-secondary">{t('enrichment.includeMatched')}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enriched}
              onChange={(e) => setEnriched(e.target.checked)}
              className="rounded border-border-default"
            />
            <span className="text-sm text-text-secondary">{t('enrichment.sideBySide')}</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost">
            {tCommon('cancel')}
          </button>
          <button onClick={handleExport} disabled={generating} className="btn-primary flex items-center gap-2">
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t('generating')}</>
            ) : (
              <><Download className="h-4 w-4" /> {t('generate')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
