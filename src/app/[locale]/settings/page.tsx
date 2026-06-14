import {getTranslations} from 'next-intl/server';
import {locales} from '@/i18n/routing';

export default async function Settings() {
  const t=await getTranslations('settings'); const c=await getTranslations('common');
  return <div className="space-y-6"><h1 className="text-4xl font-black">{t('title')}</h1><section className="lab-card p-6"><label className="block"><span className="mb-2 block text-sm text-slate-300">{t('preferredLanguage')}</span><select className="lab-input" defaultValue="en">{locales.map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label><p className="mt-4 text-sm text-slate-400">{c('language')} preference will be stored in User.preferredLocale when auth is connected.</p></section><section className="lab-card p-6 text-slate-400">{t('privacy')}</section></div>;
}
