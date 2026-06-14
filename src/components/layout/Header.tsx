import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {locales} from '@/i18n/routing';

export function Header({locale}: {locale: string}) {
  const t = useTranslations('common');
  const ru = locale === 'ru';

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-100/[0.08] bg-[#020607]/75 backdrop-blur-2xl">
      <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link href={`/${locale}`} className="group flex items-center gap-3">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] shadow-[0_0_24px_rgba(45,222,210,.08)]">
            <span className="absolute inset-[7px] rotate-45 border border-cyan-200/45" />
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_10px_#5ff9ea]" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[.16em] text-cyan-50 uppercase">{t('appName')}</span>
            <span className="hidden text-[9px] tracking-[.19em] text-cyan-100/35 uppercase sm:block">{ru ? 'Система исследовательского анализа' : 'Research Intelligence System'}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-xl border border-white/[0.05] bg-black/20 p-1 text-xs text-[#86a5a7] md:flex">
          <NavLink href={`/${locale}/dashboard`}>{t('dashboard')}</NavLink>
          <NavLink href={`/${locale}/projects`}>{t('projects')}</NavLink>
          <NavLink href={`/${locale}/hypotheses`}>{t('hypotheses')}</NavLink>
          <NavLink href={`/${locale}/settings`}>{t('settings')}</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 text-[9px] tracking-[.12em] text-emerald-300/70 uppercase lg:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_9px_#6ee7b7]" />
            {ru ? 'Системы активны' : 'Systems online'}
          </span>
          <div className="ml-2 flex rounded-lg border border-white/[0.06] bg-black/30 p-1">
            {locales.slice(0, 2).map(language => (
              <Link
                key={language}
                href={`/${language}`}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold tracking-wider transition ${language === locale ? 'bg-cyan-200/10 text-cyan-100' : 'text-slate-500 hover:text-cyan-100'}`}
              >
                {language.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({href, children}: {href: string; children: React.ReactNode}) {
  return <Link href={href} className="rounded-lg px-3 py-2 transition hover:bg-cyan-200/[0.06] hover:text-cyan-50">{children}</Link>;
}
