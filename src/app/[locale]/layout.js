import '../globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import Sidebar from './Sidebar';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });

  return {
    title: `${t('title')} - ${t('subtitle')}`,
    description: t('subtitle'),
  };
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen bg-surface-0 text-text-primary antialiased">
        <NextIntlClientProvider messages={messages}>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 min-h-screen">
              <div className="p-8">{children}</div>
            </main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
