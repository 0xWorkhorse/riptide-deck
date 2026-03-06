'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plug,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  Table2,
  Play,
  Download,
  Eye,
  X,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Shield,
} from 'lucide-react';

const DB_TYPES = [
  { value: 'postgres', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL / MariaDB', defaultPort: 3306 },
];

/* ------------------------------------------------------------------ */
/*  Connection form                                                    */
/* ------------------------------------------------------------------ */
function ConnectionForm({ onSave, onCancel }) {
  const t = useTranslations('connections');
  const tCommon = useTranslations('common');

  const [form, setForm] = useState({
    name: '',
    dbType: 'postgres',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const updateForm = (key, value) => {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      if (key === 'dbType') {
        const dbType = DB_TYPES.find((d) => d.value === value);
        if (dbType) updated.port = dbType.defaultPort;
      }
      return updated;
    });
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'test' }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Network error' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'save' }),
      });
      if (!res.ok) throw new Error('Save failed');
      onSave();
    } catch {
      setTestResult({ success: false, error: 'Failed to save connection' });
    } finally {
      setSaving(false);
    }
  };

  const canSave = form.name && form.host && form.database;

  return (
    <div className="card p-6 space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">{t('new')}</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Connection Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">
            {t('form.name')}
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            placeholder={t('form.namePlaceholder')}
            className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* DB Type */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">
            {t('form.databaseType')}
          </label>
          <select
            value={form.dbType}
            onChange={(e) => updateForm('dbType', e.target.value)}
            className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500 transition-colors"
          >
            {DB_TYPES.map((db) => (
              <option key={db.value} value={db.value}>
                {db.label}
              </option>
            ))}
          </select>
        </div>

        {/* Host */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">
            {t('form.host')}
          </label>
          <input
            type="text"
            value={form.host}
            onChange={(e) => updateForm('host', e.target.value)}
            placeholder={t('form.hostPlaceholder')}
            className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Port */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">
            {t('form.port')}
          </label>
          <input
            type="number"
            value={form.port}
            onChange={(e) => updateForm('port', Number(e.target.value))}
            placeholder={t('form.portPlaceholder')}
            className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Database Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">
            {t('form.databaseName')}
          </label>
          <input
            type="text"
            value={form.database}
            onChange={(e) => updateForm('database', e.target.value)}
            placeholder={t('form.databaseNamePlaceholder')}
            className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">
            {t('form.username')}
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => updateForm('username', e.target.value)}
            placeholder={t('form.usernamePlaceholder')}
            className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">
            {t('form.password')}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => updateForm('password', e.target.value)}
            placeholder={t('form.passwordPlaceholder')}
            className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* SSL Toggle */}
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ssl}
              onChange={(e) => updateForm('ssl', e.target.checked)}
              className="h-4 w-4 rounded border-border-default bg-surface-2 accent-brand-500"
            />
            <Shield className="h-4 w-4 text-text-muted" />
            <span className="text-sm text-text-secondary">
              {t('form.sslEnabled')}
            </span>
          </label>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            testResult.success
              ? 'bg-status-matched/10 text-status-matched'
              : 'bg-status-removed/10 text-status-removed'
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          {testResult.success
            ? t('testSuccess')
            : `${t('testFailed')}: ${testResult.error || 'Unknown error'}`}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={testing || !form.host}
          className="btn-ghost flex items-center gap-2 border border-border-default disabled:opacity-40"
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plug className="h-4 w-4" />
          )}
          {testing ? t('testing') : t('testConnection')}
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {tCommon('save')}
        </button>
        <button onClick={onCancel} className="btn-ghost">
          {tCommon('cancel')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Connection card with tables browser                                */
/* ------------------------------------------------------------------ */
function ConnectionCard({ connection, onDelete, onImport }) {
  const t = useTranslations('connections');
  const tCommon = useTranslations('common');

  const [expanded, setExpanded] = useState(false);
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [previewTable, setPreviewTable] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(null);
  const [error, setError] = useState(null);

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (tables.length > 0) return;
    setLoadingTables(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tables',
          connectionId: connection.id,
          dbType: connection.db_type,
          host: connection.host,
          port: connection.port,
          database: connection.database_name,
          username: connection.username,
          password: connection.password,
          ssl: connection.ssl,
        }),
      });
      const data = await res.json();
      setTables(data.tables || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTables(false);
    }
  };

  const handlePreview = async (tableName) => {
    if (previewTable === tableName) {
      setPreviewTable(null);
      setPreviewData(null);
      return;
    }
    setPreviewTable(tableName);
    setLoadingPreview(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'query',
          connectionId: connection.id,
          dbType: connection.db_type,
          host: connection.host,
          port: connection.port,
          database: connection.database_name,
          username: connection.username,
          password: connection.password,
          ssl: connection.ssl,
          query: `SELECT * FROM "${tableName}" LIMIT 10`,
        }),
      });
      const data = await res.json();
      setPreviewData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async (tableName) => {
    setImporting(tableName);
    try {
      await onImport(connection, tableName);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(connection.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={handleExpand}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
            <Database className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-primary">{connection.name}</p>
            <p className="text-xs text-text-muted">
              {connection.db_type} &middot; {connection.host}:{connection.port}/
              {connection.database_name}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {new Date(connection.created_at).toLocaleDateString()}
            </p>
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-text-muted shrink-0 mt-1" />
          ) : (
            <ChevronRight className="h-4 w-4 text-text-muted shrink-0 mt-1" />
          )}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ml-2 rounded p-1.5 text-text-muted hover:text-status-removed hover:bg-status-removed/10 transition-colors"
          title={tCommon('delete')}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg bg-status-removed/10 px-3 py-2 text-xs text-status-removed">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Tables list */}
      {expanded && (
        <div className="border-t border-border-subtle">
          {loadingTables ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            </div>
          ) : tables.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">
              No tables found.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {tables.map((tableName) => (
                <div key={tableName}>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <Table2 className="h-4 w-4 text-text-muted shrink-0" />
                    <span className="flex-1 text-sm font-mono text-text-primary">
                      {tableName}
                    </span>
                    <button
                      onClick={() => handlePreview(tableName)}
                      className="btn-ghost !p-1.5 text-xs"
                      title={t('queryBuilder.preview')}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleImport(tableName)}
                      disabled={importing === tableName}
                      className="btn-ghost !p-1.5 text-xs text-brand-400"
                      title={t('queryBuilder.importAsDataset')}
                    >
                      {importing === tableName ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Table preview */}
                  {previewTable === tableName && (
                    <div className="bg-surface-2 px-4 py-3">
                      {loadingPreview ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                        </div>
                      ) : previewData?.rows?.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-border-subtle">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-surface-3">
                                {(previewData.columns || Object.keys(previewData.rows[0])).map(
                                  (col) => (
                                    <th
                                      key={col}
                                      className="whitespace-nowrap px-3 py-2 text-left font-semibold text-text-muted"
                                    >
                                      {col}
                                    </th>
                                  ),
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                              {previewData.rows.map((row, i) => (
                                <tr key={i}>
                                  {(previewData.columns || Object.keys(row)).map(
                                    (col) => (
                                      <td
                                        key={col}
                                        className="whitespace-nowrap px-3 py-1.5 font-mono text-text-primary"
                                      >
                                        {row[col] ?? ''}
                                      </td>
                                    ),
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted py-2">
                          No data to preview.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Connections page                                                   */
/* ================================================================== */
export default function ConnectionsPage() {
  const t = useTranslations('connections');
  const tCommon = useTranslations('common');

  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/connections');
      if (!res.ok) throw new Error('Failed to load connections');
      const data = await res.json();
      setConnections(data.connections || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/connections?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImport = async (connection, tableName) => {
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'query',
        connectionId: connection.id,
        dbType: connection.db_type,
        host: connection.host,
        port: connection.port,
        database: connection.database_name,
        username: connection.username,
        password: connection.password,
        ssl: connection.ssl,
        query: `SELECT * FROM "${tableName}"`,
        importAsDataset: true,
        datasetName: `${connection.name} - ${tableName}`,
      }),
    });
    if (!res.ok) throw new Error('Import failed');
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
        <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('new')}
          </button>
        )}
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

      {/* New connection form */}
      {showForm && (
        <ConnectionForm
          onSave={() => {
            setShowForm(false);
            loadConnections();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Connections list */}
      {connections.length === 0 && !showForm ? (
        <div className="card p-12 text-center">
          <Database className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-sm text-text-muted">{t('empty')}</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('new')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onDelete={handleDelete}
              onImport={handleImport}
            />
          ))}
        </div>
      )}
    </div>
  );
}
