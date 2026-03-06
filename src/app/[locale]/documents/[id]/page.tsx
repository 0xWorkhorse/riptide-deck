'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  Music,
  Search,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  ExternalLink,
  Save,
  RefreshCw,
  FileText,
  Users,
  Edit3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Contributor {
  name: string;
  role: string;
  ipi?: string;
  pro?: string;
  share?: number;
}

interface DocumentSong {
  id: string;
  title: string;
  artist: string | null;
  iswc: string | null;
  bmi_id: string | null;
  ascap_id: string | null;
  mlc_id: string | null;
  contributors: Contributor[];
  publishers: Contributor[];
  raw_data: Record<string, unknown>;
  external_refs?: ExternalRef[];
}

interface ExternalRef {
  id: string;
  source: string;
  external_id: string | null;
  external_data: Record<string, unknown>;
  match_status: string;
  matched_title: string | null;
  confidence: number;
  fetched_at: string;
}

interface DocumentData {
  id: string;
  name: string;
  file_type: string;
  file_name: string | null;
  song_count: number;
  status: string;
  created_at: string;
  songs: DocumentSong[];
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('documents');
  const config = {
    match: { icon: CheckCircle2, class: 'badge-matched', label: t('status.match') },
    missing: { icon: MinusCircle, class: 'badge-modified', label: t('status.missing') },
    conflict: { icon: AlertTriangle, class: 'badge-removed', label: t('status.conflict') },
    pending: { icon: RefreshCw, class: 'bg-surface-3 text-text-muted', label: t('status.pending') },
  }[status] || { icon: MinusCircle, class: 'bg-surface-3 text-text-muted', label: status };

  const Icon = config.icon;
  return (
    <span className={`badge ${config.class}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Song Detail Panel                                                  */
/* ------------------------------------------------------------------ */

function SongDetailPanel({
  song,
  documentId,
  onUpdate,
}: {
  song: DocumentSong;
  documentId: string;
  onUpdate: (updated: DocumentSong) => void;
}) {
  const t = useTranslations('documents');
  const [expanded, setExpanded] = useState(false);
  const [lookingUp, setLookingUp] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    iswc: song.iswc || '',
    bmi_id: song.bmi_id || '',
    ascap_id: song.ascap_id || '',
    mlc_id: song.mlc_id || '',
  });
  const [saving, setSaving] = useState(false);

  const lookup = async (sources: string[]) => {
    setLookingUp(sources.join(','));
    try {
      const res = await fetch(`/api/documents/${documentId}/songs/${song.id}/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources }),
      });
      if (!res.ok) throw new Error('Lookup failed');
      const data = await res.json();
      if (data.song) {
        onUpdate(data.song);
      }
    } catch {
      // Silently handle - the UI will show the current state
    } finally {
      setLookingUp(null);
    }
  };

  const saveEdits = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/songs/${song.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iswc: editData.iswc || null,
          bmiId: editData.bmi_id || null,
          ascapId: editData.ascap_id || null,
          mlcId: editData.mlc_id || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json();
      onUpdate(updated);
      setEditing(false);
    } catch {
      // Handle error silently
    } finally {
      setSaving(false);
    }
  };

  const refs = song.external_refs || [];
  const mlcRef = refs.find((r) => r.source === 'mlc');
  const songviewRef = refs.find((r) => r.source === 'songview');

  return (
    <div className="card overflow-hidden transition-all">
      {/* Song header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-4 text-left hover:bg-surface-2/30 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand-500/10">
          <Music className="h-4 w-4 text-brand-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-text-primary">{song.title}</h4>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {song.artist && <span>{song.artist}</span>}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {song.contributors.length} {t('songDetail.writers')}
            </span>
            {song.publishers.length > 0 && (
              <span>{song.publishers.length} {t('songDetail.publishers')}</span>
            )}
          </div>
        </div>

        {/* ID badges */}
        <div className="hidden items-center gap-1.5 md:flex">
          {song.iswc && <span className="badge bg-surface-3 text-text-muted text-[9px] font-mono">ISWC</span>}
          {song.bmi_id && <span className="badge bg-surface-3 text-text-muted text-[9px] font-mono">BMI</span>}
          {song.ascap_id && <span className="badge bg-surface-3 text-text-muted text-[9px] font-mono">ASCAP</span>}
          {song.mlc_id && <span className="badge bg-surface-3 text-text-muted text-[9px] font-mono">MLC</span>}
        </div>

        {/* External ref status */}
        <div className="flex items-center gap-1">
          {mlcRef && <StatusBadge status={mlcRef.match_status} />}
          {songviewRef && <StatusBadge status={songviewRef.match_status} />}
        </div>

        {expanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border-subtle p-4 space-y-4">
          {/* IDs section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-semibold text-text-secondary">{t('songDetail.identifiers')}</h5>
              <button
                onClick={() => { setEditing(!editing); setEditData({ iswc: song.iswc || '', bmi_id: song.bmi_id || '', ascap_id: song.ascap_id || '', mlc_id: song.mlc_id || '' }); }}
                className="btn-ghost flex items-center gap-1 !px-2 !py-1 text-[10px]"
              >
                <Edit3 className="h-3 w-3" />
                {editing ? t('songDetail.cancelEdit') : t('songDetail.edit')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['iswc', 'bmi_id', 'ascap_id', 'mlc_id'] as const).map((field) => {
                const label = field === 'iswc' ? 'ISWC' : field === 'bmi_id' ? 'BMI ID' : field === 'ascap_id' ? 'ASCAP ID' : 'MLC ID';
                const value = song[field];
                return (
                  <div key={field} className="rounded bg-surface-2 px-3 py-2">
                    <p className="text-[10px] font-medium text-text-muted">{label}</p>
                    {editing ? (
                      <input
                        type="text"
                        value={editData[field]}
                        onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.value }))}
                        className="mt-0.5 w-full bg-transparent text-xs font-mono text-text-primary outline-none border-b border-brand-500"
                        placeholder={`Enter ${label}`}
                      />
                    ) : (
                      <p className="mt-0.5 text-xs font-mono text-text-primary">{value || '—'}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {editing && (
              <div className="mt-2 flex justify-end">
                <button onClick={saveEdits} disabled={saving} className="btn-primary flex items-center gap-1 !px-3 !py-1.5 text-xs">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {t('songDetail.save')}
                </button>
              </div>
            )}
          </div>

          {/* Contributors */}
          <div>
            <h5 className="mb-2 text-xs font-semibold text-text-secondary">
              {t('songDetail.writersTitle')} ({song.contributors.length})
            </h5>
            {song.contributors.length === 0 ? (
              <p className="text-xs text-text-muted">{t('songDetail.noWriters')}</p>
            ) : (
              <div className="grid gap-1.5">
                {song.contributors.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded bg-surface-2 px-3 py-1.5">
                    <div>
                      <span className="text-xs font-medium text-text-primary">{c.name}</span>
                      <span className="ml-2 text-[10px] text-text-muted">{c.role}</span>
                      {c.ipi && <span className="ml-2 text-[10px] font-mono text-text-muted">IPI: {c.ipi}</span>}
                      {c.pro && <span className="ml-2 text-[10px] text-text-muted">{c.pro}</span>}
                    </div>
                    {c.share !== undefined && c.share > 0 && (
                      <span className="text-xs font-semibold text-brand-400">{c.share}%</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publishers */}
          {song.publishers.length > 0 && (
            <div>
              <h5 className="mb-2 text-xs font-semibold text-text-secondary">
                {t('songDetail.publishersTitle')} ({song.publishers.length})
              </h5>
              <div className="grid gap-1.5">
                {song.publishers.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded bg-surface-2 px-3 py-1.5">
                    <div>
                      <span className="text-xs font-medium text-text-primary">{p.name}</span>
                      <span className="ml-2 text-[10px] text-text-muted">{p.role}</span>
                      {p.ipi && <span className="ml-2 text-[10px] font-mono text-text-muted">IPI: {p.ipi}</span>}
                    </div>
                    {p.share !== undefined && p.share > 0 && (
                      <span className="text-xs font-semibold text-brand-400">{p.share}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cross-reference lookup buttons */}
          <div className="flex items-center gap-2 border-t border-border-subtle pt-3">
            <span className="text-xs font-semibold text-text-secondary">{t('songDetail.crossReference')}:</span>
            <button
              onClick={() => lookup(['mlc'])}
              disabled={lookingUp !== null}
              className={`btn-ghost flex items-center gap-1 !px-3 !py-1.5 text-xs ${mlcRef ? '' : 'border border-border-default'}`}
            >
              {lookingUp?.includes('mlc') ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ExternalLink className="h-3 w-3" />
              )}
              MLC
              {mlcRef && <StatusBadge status={mlcRef.match_status} />}
            </button>
            <button
              onClick={() => lookup(['songview'])}
              disabled={lookingUp !== null}
              className={`btn-ghost flex items-center gap-1 !px-3 !py-1.5 text-xs ${songviewRef ? '' : 'border border-border-default'}`}
            >
              {lookingUp?.includes('songview') ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ExternalLink className="h-3 w-3" />
              )}
              SongView
              {songviewRef && <StatusBadge status={songviewRef.match_status} />}
            </button>
            <button
              onClick={() => lookup(['mlc', 'songview'])}
              disabled={lookingUp !== null}
              className="btn-primary flex items-center gap-1 !px-3 !py-1.5 text-xs"
            >
              {lookingUp ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {t('songDetail.lookupAll')}
            </button>
          </div>

          {/* External ref details */}
          {refs.length > 0 && (
            <div className="space-y-3">
              {refs.map((ref) => {
                const data = ref.external_data;
                const missingFields = (data.missingFields as string[]) || [];
                const conflictFields = (data.conflictFields as string[]) || [];
                const publishers = (data.publishers as Array<{ name: string; role: string; ipi?: string; pro?: string }>) || [];

                return (
                  <div key={ref.id} className="rounded-lg border border-border-subtle p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase text-text-secondary">
                          {ref.source === 'mlc' ? 'MLC' : 'SongView'}
                        </span>
                        <StatusBadge status={ref.match_status} />
                        <span className="text-[10px] text-text-muted">
                          {t('songDetail.confidence')}: {Math.round(ref.confidence * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* New IDs found */}
                    <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
                      {ref.source === 'mlc' && Boolean(data.mlcId) && (
                        <div className={`rounded px-2 py-1 ${!song.mlc_id ? 'bg-status-modified/10 border border-status-modified/20' : 'bg-surface-2'}`}>
                          <span className="text-[10px] text-text-muted">MLC ID</span>
                          <p className="font-mono text-text-primary">{String(data.mlcId)}</p>
                          {!song.mlc_id && <span className="text-[9px] text-status-modified">{t('status.missing')}</span>}
                        </div>
                      )}
                      {ref.source === 'songview' && (
                        <>
                          {Boolean(data.ascapId) && (
                            <div className={`rounded px-2 py-1 ${!song.ascap_id ? 'bg-status-modified/10 border border-status-modified/20' : 'bg-surface-2'}`}>
                              <span className="text-[10px] text-text-muted">ASCAP ID</span>
                              <p className="font-mono text-text-primary">{String(data.ascapId)}</p>
                              {!song.ascap_id && <span className="text-[9px] text-status-modified">{t('status.missing')}</span>}
                            </div>
                          )}
                          {Boolean(data.bmiId) && (
                            <div className={`rounded px-2 py-1 ${!song.bmi_id ? 'bg-status-modified/10 border border-status-modified/20' : 'bg-surface-2'}`}>
                              <span className="text-[10px] text-text-muted">BMI ID</span>
                              <p className="font-mono text-text-primary">{String(data.bmiId)}</p>
                              {!song.bmi_id && <span className="text-[9px] text-status-modified">{t('status.missing')}</span>}
                            </div>
                          )}
                          {Boolean(data.iswc) && (
                            <div className={`rounded px-2 py-1 ${!song.iswc ? 'bg-status-modified/10 border border-status-modified/20' : 'bg-surface-2'}`}>
                              <span className="text-[10px] text-text-muted">ISWC</span>
                              <p className="font-mono text-text-primary">{String(data.iswc)}</p>
                              {!song.iswc && <span className="text-[9px] text-status-modified">{t('status.missing')}</span>}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Additional publishers found */}
                    {publishers.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-medium text-text-muted mb-1">{t('songDetail.additionalPublishers')}</p>
                        {publishers.map((pub, i) => (
                          <div key={i} className="flex items-center gap-2 rounded bg-status-modified/5 px-2 py-1 mb-1 border border-status-modified/10">
                            <MinusCircle className="h-3 w-3 text-status-modified" />
                            <span className="text-xs text-text-primary">{pub.name}</span>
                            <span className="text-[10px] text-text-muted">{pub.role}</span>
                            {pub.ipi && <span className="text-[10px] font-mono text-text-muted">{pub.ipi}</span>}
                            <span className="text-[9px] text-status-modified">{t('status.missing')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Summary of findings */}
                    {(missingFields.length > 0 || conflictFields.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {missingFields.length > 0 && (
                          <span className="text-[10px] text-status-modified">
                            {missingFields.length} {t('songDetail.missingItems')}
                          </span>
                        )}
                        {conflictFields.length > 0 && (
                          <span className="text-[10px] text-status-removed">
                            {conflictFields.length} {t('songDetail.conflictItems')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Document Detail Page                                                */
/* ================================================================== */

export default function DocumentDetailPage() {
  const t = useTranslations('documents');
  const router = useRouter();
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lookingUpAll, setLookingUpAll] = useState(false);

  const loadDocument = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?id=${documentId}`);
      if (!res.ok) throw new Error('Document not found');
      const data = await res.json();
      setDocument(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const handleSongUpdate = (updatedSong: DocumentSong) => {
    setDocument((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        songs: prev.songs.map((s) => (s.id === updatedSong.id ? updatedSong : s)),
      };
    });
  };

  const lookupAll = async () => {
    if (!document) return;
    setLookingUpAll(true);

    for (const song of document.songs) {
      try {
        const res = await fetch(`/api/documents/${documentId}/songs/${song.id}/lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sources: ['mlc', 'songview'] }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.song) handleSongUpdate(data.song);
        }
      } catch {
        // Continue with next song
      }
    }

    setLookingUpAll(false);
  };

  const filteredSongs = document?.songs.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q) ||
      s.contributors.some((c) => c.name.toLowerCase().includes(q))
    );
  }) || [];

  const fileTypeLabel = (type: string) => {
    const map: Record<string, string> = { bmi_csv: 'BMI CSV', curve_excel: 'Curve Excel', generic_pdf: 'Generic PDF' };
    return map[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.push('/documents')} className="btn-ghost flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          {t('backToDocuments')}
        </button>
        <div className="card p-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-status-removed" />
          <p className="mt-4 text-sm text-text-muted">{error || t('notFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/documents')} className="btn-ghost !p-2">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-text-primary">{document.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
            <span className="badge bg-surface-3 text-text-secondary">{fileTypeLabel(document.file_type)}</span>
            <span className="flex items-center gap-1">
              <Music className="h-3 w-3" />
              {document.song_count} {document.song_count === 1 ? t('song') : t('songs')}
            </span>
            <span>{new Date(document.created_at).toLocaleDateString()}</span>
            {document.file_name && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {document.file_name}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={lookupAll}
          disabled={lookingUpAll}
          className="btn-primary flex items-center gap-2"
        >
          {lookingUpAll ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t('lookupAll')}
        </button>
      </div>

      {/* Search */}
      {document.songs.length > 5 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchSongs')}
            className="w-full rounded-lg border border-border-default bg-surface-1 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      )}

      {/* Song list */}
      {filteredSongs.length === 0 ? (
        <div className="card p-12 text-center">
          <Music className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-sm text-text-muted">{searchQuery ? t('noSongsFound') : t('noSongs')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSongs.map((song) => (
            <SongDetailPanel
              key={song.id}
              song={song}
              documentId={documentId}
              onUpdate={handleSongUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
