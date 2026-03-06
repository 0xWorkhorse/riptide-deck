'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Database,
  Upload,
  FileUp,
  Trash2,
  Eye,
  Loader2,
  X,
  AlertCircle,
  Search,
  FileSpreadsheet,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  File upload dropzone                                               */
/* ------------------------------------------------------------------ */
function FileDropzone({ onUpload, uploading }) {
  const t = useTranslations('upload');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) onUpload(file);
    },
    [onUpload],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`card card-hover flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
        dragOver
          ? 'border-brand-500 bg-brand-500/5'
          : 'border-border-default hover:border-text-muted'
      }`}
    >
      {uploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      ) : (
        <FileUp className="h-8 w-8 text-text-muted" />
      )}
      <p className="text-sm text-text-secondary">
        {dragOver ? t('dropzoneActive') : t('dropzone')}
      </p>
      <p className="text-xs text-text-muted">{t('supportedFormats')}</p>
      <p className="text-xs text-text-muted">{t('maxSize')}</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".csv,.tsv,.xlsx,.xls,.json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dataset preview modal                                              */
/* ------------------------------------------------------------------ */
function PreviewModal({ dataset, onClose }) {
  const t = useTranslations('datasets');

  const columns = dataset.columns || [];
  const rows = dataset.previewRows || dataset.rows?.slice(0, 10) || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card mx-4 max-h-[80vh] w-full max-w-4xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {dataset.name}
            </h3>
            <p className="text-xs text-text-muted">
              {t('actions.preview')} &mdash; First 10 rows
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost !p-2 text-text-muted hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto p-4" style={{ maxHeight: '60vh' }}>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              No preview data available.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-2">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-surface-2/50">
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="whitespace-nowrap px-4 py-2 font-mono text-text-primary"
                      >
                        {row[col] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Datasets page                                                      */
/* ================================================================== */
export default function DatasetsPage() {
  const t = useTranslations('datasets');
  const tUpload = useTranslations('upload');
  const tCommon = useTranslations('common');

  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDataset, setPreviewDataset] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadDatasets = useCallback(async () => {
    try {
      const res = await fetch('/api/datasets');
      if (!res.ok) throw new Error('Failed to load datasets');
      const data = await res.json();
      setDatasets(data.datasets || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  const handleUpload = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error(tUpload('failed'));
      await loadDatasets();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/datasets?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDatasets((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = datasets.filter((ds) =>
    (ds.name || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
      </div>

      {/* Upload area */}
      <FileDropzone onUpload={handleUpload} uploading={uploading} />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-status-removed/10 px-4 py-3 text-sm text-status-removed">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search */}
      {datasets.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full rounded-lg border border-border-default bg-surface-1 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      )}

      {/* Dataset list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Database className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-sm text-text-muted">
            {searchQuery ? tCommon('noResults') : t('empty')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-2">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('columns.name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('columns.format')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('columns.rows')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('columns.columns')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('columns.uploadedAt')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {tCommon('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtered.map((ds) => (
                <tr
                  key={ds.id}
                  className="hover:bg-surface-2/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-brand-400" />
                      <span className="font-medium text-text-primary">
                        {ds.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge bg-surface-3 text-text-secondary">
                      {ds.format || ds.source_type || 'CSV'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-secondary">
                    {(ds.rowCount ?? ds.row_count)?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-secondary">
                    {ds.columnCount ?? ds.columns?.length ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {formatDate(ds.createdAt || ds.created_at || ds.uploadedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewDataset(ds)}
                        className="btn-ghost !p-2"
                        title={t('actions.preview')}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(ds.id)}
                        disabled={deletingId === ds.id}
                        className="btn-ghost !p-2 text-status-removed hover:text-status-removed"
                        title={t('actions.delete')}
                      >
                        {deletingId === ds.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview modal */}
      {previewDataset && (
        <PreviewModal
          dataset={previewDataset}
          onClose={() => setPreviewDataset(null)}
        />
      )}
    </div>
  );
}
