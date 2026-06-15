import {getTranslations} from 'next-intl/server';
import {locales} from '@/i18n/routing';
import {getCurrentUser} from '@/lib/auth/current-user';
import {redirect} from 'next/navigation';

export default async function Settings({params}: {params: Promise<{locale: string}>}) {
  const {locale}=await params;
  if(!await getCurrentUser()) redirect(`/${locale}/login`);
  const t=await getTranslations('settings'); const c=await getTranslations('common');
  return <div className="space-y-6"><h1 className="text-4xl font-black">{t('title')}</h1><section className="lab-card p-6"><label className="block"><span className="mb-2 block text-sm text-slate-300">{t('preferredLanguage')}</span><select className="lab-input" defaultValue={locale}>{locales.map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label><p className="mt-4 text-sm text-slate-400">{c('language')}</p></section><section className="lab-card p-6 text-slate-400">{t('privacy')}</section></div>;
}
