'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  GitCompareArrows,
  Upload,
  Plug,
  BarChart3,
  AlertTriangle,
  Database,
  Zap,
  Music,
  FileText,
  LucideIcon,
  Loader2,
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, color, loading }: { icon: LucideIcon; label: string; value: string; color: string; loading?: boolean }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}20`, color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        ) : (
          <p className="text-2xl font-semibold text-text-primary">{value}</p>
        )}
        <p className="text-xs text-text-muted">{label}</p>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, description, href }: { icon: LucideIcon; label: string; description: string; href: string }) {
  return (
    <Link href={href} className="card card-hover flex items-start gap-4 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="mt-1 text-xs text-text-muted">{description}</p>
      </div>
    </Link>
  );
}

interface DashboardStats {
  comparisons: number;
  exceptions: number;
  datasets: number;
  connections: number;
  songs: number;
  documents: number;
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tNav = useTranslations('nav');
  const tUpload = useTranslations('upload');
  const tConn = useTranslations('connections');
  const tSongs = useTranslations('songs');
  const tDocs = useTranslations('documents');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      icon: Music,
      label: t('stats.songsRegistered'),
      value: String(stats?.songs ?? 0),
      color: 'oklch(0.72 0.18 155)',
    },
    {
      icon: FileText,
      label: t('stats.documentsImported'),
      value: String(stats?.documents ?? 0),
      color: 'oklch(0.65 0.16 230)',
    },
    {
      icon: BarChart3,
      label: t('stats.totalComparisons'),
      value: String(stats?.comparisons ?? 0),
      color: 'oklch(0.55 0.18 230)',
    },
    {
      icon: AlertTriangle,
      label: t('stats.openExceptions'),
      value: String(stats?.exceptions ?? 0),
      color: 'oklch(0.78 0.16 80)',
    },
    {
      icon: Database,
      label: t('stats.datasetsLoaded'),
      value: String(stats?.datasets ?? 0),
      color: 'oklch(0.72 0.18 155)',
    },
    {
      icon: Zap,
      label: t('stats.connectionsActive'),
      value: String(stats?.connections ?? 0),
      color: 'oklch(0.72 0.16 200)',
    },
  ];

  const quickActions = [
    {
      icon: Music,
      label: tSongs('newSong'),
      description: t('actions.storyToSplits'),
      href: '/songs/new',
    },
    {
      icon: FileText,
      label: tDocs('upload.title'),
      description: t('actions.documentToSplits'),
      href: '/documents',
    },
    {
      icon: GitCompareArrows,
      label: tNav('newComparison'),
      description: t('description'),
      href: '/comparison/new',
    },
    {
      icon: Upload,
      label: tUpload('title'),
      description: tUpload('supportedFormats'),
      href: '/datasets',
    },
    {
      icon: Plug,
      label: tConn('new'),
      description: tConn('title'),
      href: '/connections',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('welcome')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('description')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={loading} />
        ))}
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          {t('quickActions')}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <QuickAction key={action.href} {...action} />
          ))}
        </div>
      </section>

      {/* Recent Comparisons */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          {t('recentComparisons')}
        </h2>
        <div className="card p-8 text-center">
          <p className="text-sm text-text-muted">{t('noRecent')}</p>
        </div>
      </section>
    </div>
  );
}
