import {getTranslations} from 'next-intl/server';
import {prisma} from '@/lib/db/prisma';
import {getCurrentUser} from '@/lib/auth/current-user';
import {redirect} from 'next/navigation';

export default async function AdminPrompts({params}: {params: Promise<{locale: string}>}){const {locale}=await params;if(!await getCurrentUser()) redirect(`/${locale}/login`);const t=await getTranslations('admin'); const prompts=await prisma.analysisPrompt.findMany(); return <div className="space-y-6"><h1 className="text-4xl font-black">{t('title')}</h1><div className="lab-card p-6 text-slate-400">{t('placeholder')}</div><div className="grid gap-4">{prompts.map(p=><div className="lab-card p-5" key={p.id}><h2 className="font-bold">{p.title}</h2><p className="mt-2 text-sm text-slate-400">{p.key}</p></div>)}</div></div>}
