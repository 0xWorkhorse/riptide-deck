'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  Check,
  Loader2,
  Link2,
  Unlink,
  Play,
} from 'lucide-react';

const STEPS = ['selectDatasets', 'mapColumns', 'selectKeys', 'configure', 'review'];

interface Dataset {
  id: string;
  name: string;
  columns: string[];
  row_count: number;
  data?: Record<string, unknown>[];
}

export default function NewComparisonPage() {
  const t = useTranslations('comparison');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [sourceAId, setSourceAId] = useState('');
  const [sourceBId, setSourceBId] = useState('');
  const [sourceA, setSourceA] = useState<Dataset | null>(null);
  const [sourceB, setSourceB] = useState<Dataset | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [keyColumns, setKeyColumns] = useState<string[]>([]);
  const [config, setConfig] = useState({
    caseSensitive: false,
    numericTolerance: 0,
    trimWhitespace: true,
    name: '',
  });
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/datasets')
      .then((r) => r.json())
      .then((d) => setDatasets(d.datasets || []));
  }, []);

  const loadDataset = useCallback(async (id: string, setter: (ds: Dataset) => void) => {
    const res = await fetch(`/api/datasets?id=${id}`);
    const data = await res.json();
    setter(data);
  }, []);

  useEffect(() => {
    if (sourceAId) loadDataset(sourceAId, setSourceA);
  }, [sourceAId, loadDataset]);

  useEffect(() => {
    if (sourceBId) loadDataset(sourceBId, setSourceB);
  }, [sourceBId, loadDataset]);

  // Auto-map columns when both datasets are loaded
  useEffect(() => {
    if (sourceA && sourceB) {
      const mapping: Record<string, string> = {};
      for (const colB of sourceB.columns) {
        const exact = sourceA.columns.find((a) => a === colB);
        if (exact) {
          mapping[colB] = exact;
        } else {
          const lower = sourceA.columns.find(
            (a) => a.toLowerCase() === colB.toLowerCase()
          );
          if (lower) mapping[colB] = lower;
        }
      }
      setColumnMapping(mapping);
    }
  }, [sourceA, sourceB]);

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    setUploading(false);
    if (data.id) {
      setDatasets((prev) => [{ id: data.id, name: data.name, columns: data.columns, row_count: data.rowCount }, ...prev]);
    }
  }

  async function runComparison() {
    setRunning(true);
    const res = await fetch('/api/comparisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceAId,
        sourceBId,
        name: config.name,
        config: {
          keyColumns,
          compareColumns: [],
          columnMapping,
          caseSensitive: config.caseSensitive,
          numericTolerance: Number(config.numericTolerance) || 0,
          trimWhitespace: config.trimWhitespace,
        },
      }),
    });
    const data = await res.json();
    setRunning(false);
    if (data.id) {
      router.push(`/comparison/${data.id}`);
    }
  }

  const canNext = () => {
    if (step === 0) return sourceAId && sourceBId;
    if (step === 1) return Object.keys(columnMapping).length > 0;
    if (step === 2) return keyColumns.length > 0;
    return true;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === step
                  ? 'bg-brand-500 text-white'
                  : i < step
                  ? 'bg-brand-500/20 text-brand-400 cursor-pointer'
                  : 'bg-surface-2 text-text-muted'
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              {t(`steps.${s}`)}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-text-muted" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="card p-6">
        {/* Step 0: Select datasets */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">{t('selectDatasets.title')}</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  {t('selectDatasets.sourceLabel')}
                </label>
                <select
                  value={sourceAId}
                  onChange={(e) => setSourceAId(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary"
                >
                  <option value="">{t('selectDatasets.sourcePlaceholder')}</option>
                  {datasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>{ds.name} ({ds.row_count} rows)</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  {t('selectDatasets.targetLabel')}
                </label>
                <select
                  value={sourceBId}
                  onChange={(e) => setSourceBId(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary"
                >
                  <option value="">{t('selectDatasets.targetPlaceholder')}</option>
                  {datasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>{ds.name} ({ds.row_count} rows)</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="btn-ghost flex cursor-pointer items-center gap-2 border border-border-default">
                <Upload className="h-4 w-4" />
                {uploading ? tCommon('loading') : t('selectDatasets.orUpload')}
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".csv,.tsv,.xlsx,.xls,.json,.txt" />
              </label>
            </div>
          </div>
        )}

        {/* Step 1: Map columns */}
        {step === 1 && sourceA && sourceB && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{t('mapColumns.title')}</h2>
                <p className="text-sm text-text-muted">{t('mapColumns.description')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const auto: Record<string, string> = {};
                    for (const colB of sourceB.columns) {
                      const match = sourceA.columns.find(
                        (a) => a.toLowerCase() === colB.toLowerCase()
                      );
                      if (match) auto[colB] = match;
                    }
                    setColumnMapping(auto);
                  }}
                  className="btn-ghost flex items-center gap-1 text-xs border border-border-default"
                >
                  <Link2 className="h-3 w-3" /> {t('mapColumns.autoMap')}
                </button>
                <button
                  onClick={() => setColumnMapping({})}
                  className="btn-ghost flex items-center gap-1 text-xs border border-border-default"
                >
                  <Unlink className="h-3 w-3" /> {t('mapColumns.clearAll')}
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="px-3 py-2 text-left text-text-muted font-medium">
                      {t('mapColumns.targetColumn')} (B)
                    </th>
                    <th className="px-3 py-2 text-left text-text-muted font-medium">
                      {t('mapColumns.sourceColumn')} (A)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sourceB.columns.map((colB) => (
                    <tr key={colB} className="border-b border-border-subtle">
                      <td className="px-3 py-2 text-text-primary">{colB}</td>
                      <td className="px-3 py-2">
                        <select
                          value={columnMapping[colB] || ''}
                          onChange={(e) => {
                            setColumnMapping((prev) => {
                              const next = { ...prev };
                              if (e.target.value) {
                                next[colB] = e.target.value;
                              } else {
                                delete next[colB];
                              }
                              return next;
                            });
                          }}
                          className="w-full rounded border border-border-default bg-surface-2 px-2 py-1 text-sm text-text-primary"
                        >
                          <option value="">— {t('mapColumns.unmapped')} —</option>
                          {sourceA.columns.map((colA) => (
                            <option key={colA} value={colA}>{colA}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 2: Select key columns */}
        {step === 2 && sourceA && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('selectKeys.title')}</h2>
            <p className="text-sm text-text-muted">{t('selectKeys.description')}</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {sourceA.columns.map((col) => (
                <button
                  key={col}
                  onClick={() => {
                    setKeyColumns((prev) =>
                      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                    );
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                    keyColumns.includes(col)
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-border-default bg-surface-2 text-text-secondary hover:border-brand-500/50'
                  }`}
                >
                  {keyColumns.includes(col) && <Check className="mr-1 inline h-3 w-3" />}
                  {col}
                </button>
              ))}
            </div>
            {keyColumns.length > 1 && (
              <p className="text-xs text-text-muted">{t('selectKeys.compositeKeyNote')}</p>
            )}
          </div>
        )}

        {/* Step 3: Configure */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">{t('configure.title')}</h2>
            <div className="space-y-4 max-w-md">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text-secondary">
                  {t('configure.comparisonName')}
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
                  placeholder={t('configure.comparisonNamePlaceholder')}
                  className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text-secondary">
                  {t('configure.toleranceLabel')}
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={config.numericTolerance}
                  onChange={(e) => setConfig((c) => ({ ...c, numericTolerance: Number(e.target.value) }))}
                  placeholder={t('configure.tolerancePlaceholder')}
                  className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary"
                />
                <p className="text-xs text-text-muted">{t('configure.toleranceHelp')}</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.caseSensitive}
                  onChange={(e) => setConfig((c) => ({ ...c, caseSensitive: e.target.checked }))}
                  className="rounded border-border-default"
                />
                <span className="text-sm text-text-secondary">{t('configure.caseSensitive')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.trimWhitespace}
                  onChange={(e) => setConfig((c) => ({ ...c, trimWhitespace: e.target.checked }))}
                  className="rounded border-border-default"
                />
                <span className="text-sm text-text-secondary">{t('configure.ignoreWhitespace')}</span>
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Review & Run */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">{t('review.title')}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-surface-2 p-4">
                <p className="text-xs font-medium uppercase text-text-muted">{t('review.source')}</p>
                <p className="mt-1 text-sm font-medium text-text-primary">{sourceA?.name}</p>
                <p className="text-xs text-text-muted">{sourceA?.row_count} rows, {sourceA?.columns?.length} columns</p>
              </div>
              <div className="rounded-lg bg-surface-2 p-4">
                <p className="text-xs font-medium uppercase text-text-muted">{t('review.target')}</p>
                <p className="mt-1 text-sm font-medium text-text-primary">{sourceB?.name}</p>
                <p className="text-xs text-text-muted">{sourceB?.row_count} rows, {sourceB?.columns?.length} columns</p>
              </div>
            </div>
            <div className="rounded-lg bg-surface-2 p-4 space-y-2">
              <p className="text-xs font-medium uppercase text-text-muted">{t('review.keyColumns')}</p>
              <div className="flex flex-wrap gap-1">
                {keyColumns.map((k) => (
                  <span key={k} className="badge bg-brand-500/15 text-brand-400">{k}</span>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-surface-2 p-4 space-y-2">
              <p className="text-xs font-medium uppercase text-text-muted">{t('review.mappedColumns')}</p>
              <p className="text-sm text-text-secondary">
                {Object.keys(columnMapping).length} columns mapped
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="btn-ghost flex items-center gap-1 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> {tCommon('back')}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="btn-primary flex items-center gap-1 disabled:opacity-50"
          >
            {tCommon('next')} <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={runComparison}
            disabled={running}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {running ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t('running')}</>
            ) : (
              <><Play className="h-4 w-4" /> {t('review.run')}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
