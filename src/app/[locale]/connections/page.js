'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plug,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
} from 'lucide-react';

const DB_TYPES = [
  { value: 'postgres', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL / MariaDB', defaultPort: 3306 },
];

export default function ConnectionsPage() {
  const t = useTranslations('connections');
  const tCommon = useTranslations('common');

  const [connections, setConnections] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
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

  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchConnections() {
    const res = await fetch('/api/connections');
    const data = await res.json();
    setConnections(data.connections || []);
    setLoading(false);
  }

  function updateForm(key, value) {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      if (key === 'dbType') {
        const dbType = DB_TYPES.find((d) => d.value === value);
        if (dbType) updated.port = dbType.defaultPort;
      }
      return updated;
    });
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, action: 'test' }),
    });
    const data = await res.json();
    setTestResult(data);
    setTesting(false);
  }

  async function handleSave() {
    await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ name: '', dbType: 'postgres', host: '', port: 5432, database: '', username: '', password: '', ssl: false });
    setTestResult(null);
    fetchConnections();
  }

  async function handleDelete(id) {
    await fetch(`/api/connections?id=${id}`, { method: 'DELETE' });
    fetchConnections();
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> {t('new')}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{t('new')}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">{t('form.name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder={t('form.namePlaceholder')}
                className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">{t('form.databaseType')}</label>
              <select
                value={form.dbType}
                onChange={(e) => updateForm('dbType', e.target.value)}
                className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary"
              >
                {DB_TYPES.map((db) => (
                  <option key={db.value} value={db.value}>{db.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">{t('form.host')}</label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => updateForm('host', e.target.value)}
                placeholder={t('form.hostPlaceholder')}
                className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">{t('form.port')}</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => updateForm('port', Number(e.target.value))}
                className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">{t('form.databaseName')}</label>
              <input
                type="text"
                value={form.database}
                onChange={(e) => updateForm('database', e.target.value)}
                placeholder={t('form.databaseNamePlaceholder')}
                className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">{t('form.username')}</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => updateForm('username', e.target.value)}
                placeholder={t('form.usernamePlaceholder')}
                className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">{t('form.password')}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateForm('password', e.target.value)}
                placeholder={t('form.passwordPlaceholder')}
                className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={form.ssl}
                  onChange={(e) => updateForm('ssl', e.target.checked)}
                  className="rounded border-border-default"
                />
                <span className="text-sm text-text-secondary">{t('form.sslEnabled')}</span>
              </label>
            </div>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
              testResult.success ? 'bg-status-matched/10 text-status-matched' : 'bg-status-removed/10 text-status-removed'
            }`}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.success ? t('testSuccess') : `${t('testFailed')}: ${testResult.error}`}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleTest} disabled={testing} className="btn-ghost border border-border-default flex items-center gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {testing ? t('testing') : t('testConnection')}
            </button>
            <button onClick={handleSave} className="btn-primary" disabled={!form.name || !form.host}>
              {tCommon('save')}
            </button>
            <button onClick={() => { setShowForm(false); setTestResult(null); }} className="btn-ghost">
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}

      {connections.length === 0 && !showForm ? (
        <div className="card p-12 text-center">
          <Database className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-sm text-text-muted">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {connections.map((conn) => (
            <div key={conn.id} className="card p-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">{conn.name}</p>
                  <p className="text-xs text-text-muted">
                    {conn.db_type} &middot; {conn.host}:{conn.port}/{conn.database_name}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {new Date(conn.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(conn.id)}
                className="rounded p-1 text-text-muted hover:text-status-removed hover:bg-status-removed/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
