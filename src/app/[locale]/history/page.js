'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  History,
  Trash2,
  GitCompareArrows,
  Loader2,
  CheckCircle,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';

export default function HistoryPage() {
  const t = useTranslations('exceptions');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');

  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComparisons();
  }, []);

  async function fetchComparisons() {
    const res = await fetch('/api/comparisons');
    const data = await res.json();
    setComparisons(data.comparisons || []);
    setLoading(false);
  }

  async function handleDelete(id) {
    await fetch(`/api/comparisons?id=${id}`, { method: 'DELETE' });
    fetchComparisons();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">{tNav('history')}</h1>

      {comparisons.length === 0 ? (
        <div className="card p-12 text-center">
          <History className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-sm text-text-muted">No comparisons yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comparisons.map((comp) => (
            <Link
              key={comp.id}
              href={`/comparison/${comp.id}`}
              className="card card-hover flex items-center gap-4 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                <GitCompareArrows className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">{comp.name}</p>
                <p className="text-xs text-text-muted">
                  {new Date(comp.created_at).toLocaleString()} &middot; {comp.status}
                </p>
              </div>
              {comp.summary && (
                <div className="hidden sm:flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-status-matched">
                    <CheckCircle className="h-3 w-3" /> {comp.summary.matched || 0}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-status-modified">
                    <AlertTriangle className="h-3 w-3" /> {comp.summary.modified || 0}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-status-added">
                    <PlusCircle className="h-3 w-3" /> {comp.summary.added || 0}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-status-removed">
                    <MinusCircle className="h-3 w-3" /> {comp.summary.removed || 0}
                  </span>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(comp.id);
                }}
                className="rounded p-1 text-text-muted hover:text-status-removed hover:bg-status-removed/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
