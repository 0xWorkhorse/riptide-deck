'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  Music,
  Plus,
  Search,
  Loader2,
  Trash2,
  Eye,
  Users,
  X,
  AlertCircle,
  FileText,
  ChevronRight,
} from 'lucide-react';

interface SongRecord {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  record_label: string | null;
  is_instrumental: boolean;
  status: string;
  source_type: string;
  created_at: string;
}

interface SongDetail {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  record_label: string | null;
  iswc: string | null;
  bmi_id: string | null;
  ascap_id: string | null;
  mlc_id: string | null;
  is_instrumental: boolean;
  status: string;
  source_type: string;
  notes: string | null;
  created_at: string;
  contributors: Array<{
    id: string;
    name: string;
    role: string;
    ipi: string | null;
    pro: string | null;
    split_percent: number;
    split_type: string;
  }>;
}

function SongDetailModal({ songId, onClose }: { songId: string; onClose: () => void }) {
  const t = useTranslations('songs');
  const [song, setSong] = useState<SongDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/songs?id=${songId}`)
      .then((r) => r.json())
      .then(setSong)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [songId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card mx-4 max-h-[80vh] w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <h3 className="text-lg font-semibold text-text-primary">{t('detail.title')}</h3>
          <button onClick={onClose} className="btn-ghost !p-2 text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6" style={{ maxHeight: '65vh' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : !song ? (
            <p className="text-center text-sm text-text-muted">{t('detail.notFound')}</p>
          ) : (
            <div className="space-y-6">
              {/* Song info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{t('form.title')}</p>
                  <p className="text-sm font-medium text-text-primary">{song.title}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{t('form.artist')}</p>
                  <p className="text-sm text-text-primary">{song.artist || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{t('form.album')}</p>
                  <p className="text-sm text-text-primary">{song.album || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{t('form.recordLabel')}</p>
                  <p className="text-sm text-text-primary">{song.record_label || '—'}</p>
                </div>
              </div>

              {/* IDs */}
              <div>
                <p className="mb-2 text-xs font-semibold text-text-secondary">{t('detail.identifiers')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'ISWC', value: song.iswc },
                    { label: 'BMI ID', value: song.bmi_id },
                    { label: 'ASCAP ID', value: song.ascap_id },
                    { label: 'MLC ID', value: song.mlc_id },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-2 rounded bg-surface-2 px-3 py-1.5">
                      <span className="text-[10px] font-medium text-text-muted">{label}</span>
                      <span className="text-xs font-mono text-text-primary">{value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contributors */}
              <div>
                <p className="mb-2 text-xs font-semibold text-text-secondary">
                  {t('form.contributors')} ({song.contributors.length})
                </p>
                {song.contributors.length === 0 ? (
                  <p className="text-xs text-text-muted">{t('form.noContributors')}</p>
                ) : (
                  <div className="space-y-2">
                    {song.contributors.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-2">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{c.name}</p>
                          <p className="text-[10px] text-text-muted">
                            {t(`roles.${c.role}`)} {c.pro ? `· ${c.pro}` : ''} {c.ipi ? `· IPI: ${c.ipi}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-brand-400">{c.split_percent}%</p>
                          <p className="text-[10px] text-text-muted">{c.split_type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2">
                <span className={`badge ${song.is_instrumental ? 'bg-brand-500/15 text-brand-400' : 'bg-surface-3 text-text-muted'}`}>
                  {song.is_instrumental ? t('form.instrumental') : t('detail.hasLyrics')}
                </span>
                <span className="badge bg-surface-3 text-text-secondary">{song.source_type}</span>
                <span className={`badge ${song.status === 'registered' ? 'badge-matched' : 'badge-modified'}`}>
                  {song.status}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SongsPage() {
  const t = useTranslations('songs');
  const tCommon = useTranslations('common');

  const [songs, setSongs] = useState<SongRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSongs = useCallback(async () => {
    try {
      const res = await fetch('/api/songs');
      if (!res.ok) throw new Error('Failed to load songs');
      const data = await res.json();
      setSongs(data.songs || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/songs?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setSongs((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = songs.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q) ||
      (s.album || '').toLowerCase().includes(q)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
          <p className="text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
        <Link href="/songs/new" className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t('newSong')}
        </Link>
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
      {songs.length > 0 && (
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

      {/* Song list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Music className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-sm text-text-muted">
            {searchQuery ? tCommon('noResults') : t('empty')}
          </p>
          {!searchQuery && (
            <Link href="/songs/new" className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t('newSong')}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((song) => (
            <div key={song.id} className="card card-hover p-4 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                  <Music className="h-5 w-5 text-brand-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-text-primary">
                      {song.title}
                    </h3>
                    {song.is_instrumental && (
                      <span className="badge bg-brand-500/15 text-brand-400 text-[10px]">
                        {t('form.instrumental')}
                      </span>
                    )}
                    <span className={`badge text-[10px] ${song.status === 'registered' ? 'badge-matched' : 'badge-modified'}`}>
                      {song.status}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-text-muted">
                    {song.artist && <span>{song.artist}</span>}
                    {song.album && (
                      <>
                        <span className="text-border-default">·</span>
                        <span>{song.album}</span>
                      </>
                    )}
                    {song.record_label && (
                      <>
                        <span className="text-border-default">·</span>
                        <span>{song.record_label}</span>
                      </>
                    )}
                    <span className="text-border-default">·</span>
                    <span>{formatDate(song.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="badge bg-surface-3 text-text-muted text-[10px]">
                    {song.source_type === 'story' ? (
                      <><FileText className="mr-1 inline h-3 w-3" />{t('sourceStory')}</>
                    ) : (
                      <><Users className="mr-1 inline h-3 w-3" />{t('sourceDocument')}</>
                    )}
                  </span>
                  <button
                    onClick={() => setSelectedSong(song.id)}
                    className="btn-ghost !p-2"
                    title={t('view')}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(song.id)}
                    disabled={deletingId === song.id}
                    className="btn-ghost !p-2 text-status-removed hover:text-status-removed"
                    title={tCommon('delete')}
                  >
                    {deletingId === song.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                  <ChevronRight className="h-4 w-4 text-text-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedSong && (
        <SongDetailModal songId={selectedSong} onClose={() => setSelectedSong(null)} />
      )}
    </div>
  );
}
