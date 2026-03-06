'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  History,
  Trash2,
  GitCompareArrows,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  Search,
  X,
  AlertCircle,
  Calendar,
} from 'lucide-react';

/* ================================================================== */
/*  History page                                                       */
/* ================================================================== */
export default function HistoryPage() {
  const t = useTranslations('exceptions');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');


  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadComparisons = useCallback(async () => {
    try {
      const res = await fetch('/api/comparisons');
      if (!res.ok) throw new Error('Failed to load comparisons');
      const data = await res.json();
      setComparisons(data.comparisons || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComparisons();
  }, [loadComparisons]);

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      const res = await fetch(`/api/comparisons?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setComparisons((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = comparisons.filter((comp) =>
    (comp.name || '').toLowerCase().includes(searchQuery.toLowerCase()),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          {tNav('history')}
        </h1>
      </div>

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
      {comparisons.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tCommon('search')}
            className="w-full rounded-lg border border-border-default bg-surface-1 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <History className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-sm text-text-muted">
            {searchQuery ? tCommon('noResults') : 'No comparisons yet. Start one to see results here.'}
          </p>
          {!searchQuery && (
            <Link
              href="/comparison/new"
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <GitCompareArrows className="h-4 w-4" />
              {tNav('newComparison')}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((comp) => {
            const summary = comp.summary || {};
            return (
              <Link
                key={comp.id}
                href={`/comparison/${comp.id}`}
                className="card card-hover flex items-center gap-4 p-5 transition-all"
              >
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                  <GitCompareArrows className="h-5 w-5" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {comp.name || `Comparison ${comp.id}`}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(comp.created_at || comp.createdAt)}
                    </span>
                    {comp.sourceAName && (
                      <span>
                        {comp.sourceAName} vs {comp.sourceBName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary badges */}
                <div className="hidden items-center gap-3 sm:flex">
                  <span className="badge badge-matched">
                    <CheckCircle2 className="h-3 w-3" />
                    {summary.matched || 0}
                  </span>
                  <span className="badge badge-modified">
                    <AlertTriangle className="h-3 w-3" />
                    {summary.modified || 0}
                  </span>
                  <span className="badge badge-added">
                    <PlusCircle className="h-3 w-3" />
                    {summary.added || 0}
                  </span>
                  <span className="badge badge-removed">
                    <MinusCircle className="h-3 w-3" />
                    {summary.removed || 0}
                  </span>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => handleDelete(comp.id, e)}
                  disabled={deletingId === comp.id}
                  className="rounded p-1.5 text-text-muted hover:text-status-removed hover:bg-status-removed/10 transition-colors"
                  title={tCommon('delete')}
                >
                  {deletingId === comp.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
