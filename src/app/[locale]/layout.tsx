import type {Metadata} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {FuturisticShell} from '@/components/layout/FuturisticShell';
import '../globals.css';

export const metadata: Metadata = {title: 'TheoryForge', description: 'AI research workspace for impossible ideas'};

export default async function LocaleLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const messages = await getMessages();
  return <html lang={locale}><body><NextIntlClientProvider messages={messages}><FuturisticShell locale={locale}>{children}</FuturisticShell></NextIntlClientProvider></body></html>;
}
