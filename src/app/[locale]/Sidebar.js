'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import {
  LayoutDashboard,
  GitCompareArrows,
  Database,
  Plug,
  History,
  Waves,
} from 'lucide-react';

const navItems = [
  { key: 'dashboard', href: '/', icon: LayoutDashboard },
  { key: 'newComparison', href: '/comparison/new', icon: GitCompareArrows },
  { key: 'datasets', href: '/datasets', icon: Database },
  { key: 'connections', href: '/connections', icon: Plug },
  { key: 'history', href: '/history', icon: History },
];

export default function Sidebar() {
  const t = useTranslations('nav');
  const tApp = useTranslations('app');
  const pathname = usePathname();

  function isActive(href) {
    if (href === '/') {
      // Strip locale prefix and check for root
      const stripped = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
      return stripped === '/' || stripped === '';
    }
    return pathname.includes(href);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border-subtle bg-surface-1">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-border-subtle">
        <Waves className="h-6 w-6 text-brand-500" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-wide text-text-primary">
            {tApp('title')}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
            {tApp('subtitle')}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map(({ key, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={key}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-500/10 text-brand-400'
                      : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border-subtle px-4 py-3">
        <p className="text-[11px] text-text-muted">
          &copy; {new Date().getFullYear()} Riptide Music Publishing
        </p>
      </div>
    </aside>
  );
}
