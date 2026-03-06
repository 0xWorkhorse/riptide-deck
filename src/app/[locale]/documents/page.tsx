'use client';

import { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  FileText,
  Upload,
  Loader2,
  Trash2,
  Search,
  AlertCircle,
  X,
  FileSpreadsheet,
  File,
  ChevronRight,
  Music,
} from 'lucide-react';

interface DocumentRecord {
  id: string;
  name: string;
  file_type: string;
  file_name: string | null;
  song_count: number;
  status: string;
  created_at: string;
}

const FILE_TYPES = [
  { value: 'bmi_csv', label: 'BMI CSV', icon: FileSpreadsheet, accept: '.csv' },
  { value: 'curve_excel', label: 'Curve Excel', icon: FileSpreadsheet, accept: '.xlsx,.xls' },
  { value: 'generic_pdf', label: 'Generic PDF', icon: File, accept: '.pdf' },
] as const;

function DocumentUpload({ onUploadComplete }: { onUploadComplete: () => void }) {
  const t = useTranslations('documents');
  const [selectedType, setSelectedType] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!selectedType) {
      setError(t('upload.selectType'));
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('fileType', selectedType);

      const res = await fetch('/api/documents/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      onUploadComplete();
      setSelectedType('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleUpload(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedType],
  );

  const selectedConfig = FILE_TYPES.find((ft) => ft.value === selectedType);

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Upload className="h-4 w-4 text-brand-400" />
        {t('upload.title')}
      </h3>
      <p className="text-xs text-text-secondary">{t('upload.description')}</p>

      {/* File type selection */}
      <div className="grid grid-cols-3 gap-3">
        {FILE_TYPES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setSelectedType(value)}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              selectedType === value
                ? 'border-brand-500 bg-brand-500/5'
                : 'border-border-default hover:border-text-muted'
            }`}
          >
            <Icon className={`h-6 w-6 ${selectedType === value ? 'text-brand-400' : 'text-text-muted'}`} />
            <span className={`text-xs font-medium ${selectedType === value ? 'text-brand-400' : 'text-text-secondary'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          !selectedType
            ? 'border-border-subtle opacity-50 cursor-not-allowed'
            : dragOver
              ? 'border-brand-500 bg-brand-500/5'
              : 'border-border-default hover:border-text-muted'
        }`}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        ) : (
          <Upload className="h-8 w-8 text-text-muted" />
        )}
        <p className="text-sm text-text-secondary">
          {!selectedType ? t('upload.selectTypeFirst') : t('upload.dropzone')}
        </p>
        {selectedConfig && (
          <p className="text-xs text-text-muted">
            {t('upload.accepted')}: {selectedConfig.accept}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={selectedConfig?.accept || '*'}
          disabled={!selectedType}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-status-removed/10 px-4 py-3 text-sm text-status-removed">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Failed to load documents');
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = documents.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const fileTypeLabel = (type: string) => {
    const config = FILE_TYPES.find((ft) => ft.value === type);
    return config?.label || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
        <p className="text-sm text-text-secondary">{t('subtitle')}</p>
      </div>

      {/* Upload */}
      <DocumentUpload onUploadComplete={() => { setLoading(true); loadDocuments(); }} />

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
      {documents.length > 0 && (
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

      {/* Documents list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-sm text-text-muted">
            {searchQuery ? tCommon('noResults') : t('empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="card card-hover flex items-center gap-4 p-4 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                <FileText className="h-5 w-5 text-brand-400" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-text-primary">{doc.name}</h3>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-text-muted">
                  <span className="badge bg-surface-3 text-text-secondary text-[10px]">{fileTypeLabel(doc.file_type)}</span>
                  <span className="flex items-center gap-1">
                    <Music className="h-3 w-3" />
                    {doc.song_count} {doc.song_count === 1 ? t('song') : t('songs')}
                  </span>
                  <span>{formatDate(doc.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(doc.id); }}
                  disabled={deletingId === doc.id}
                  className="btn-ghost !p-2 text-status-removed hover:text-status-removed"
                  title={tCommon('delete')}
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
                <ChevronRight className="h-4 w-4 text-text-muted" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
