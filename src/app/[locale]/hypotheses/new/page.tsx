import {getTranslations} from 'next-intl/server';
import {prisma} from '@/lib/db/prisma';
import {createHypothesisAction} from '@/server/actions/hypotheses';
import {getCurrentUser} from '@/lib/auth/current-user';
import {redirect} from 'next/navigation';

export default async function NewHypothesis({params, searchParams}: {params: Promise<{locale:string}>; searchParams: Promise<{project?:string}>}) {
  const {locale}=await params; const sp=await searchParams; const t=await getTranslations('hypothesis'); const workspaceT=await getTranslations({locale:locale==='ru'?'ru':'en',namespace:'hypothesis'}); const c=await getTranslations('common');
  const user=await getCurrentUser();
  if(!user) redirect(`/${locale}/login`);
  const projects=await prisma.project.findMany({where:{ownerId:user.id},orderBy:{createdAt:'desc'}});
  return <div className="mx-auto max-w-3xl"><h1 className="mb-6 text-4xl font-black">{t('createTitle')}</h1><form action={createHypothesisAction.bind(null, locale)} className="lab-card space-y-4 p-6">
    <label className="block"><span className="mb-2 block text-sm text-slate-300">{c('project')}</span><select className="lab-input" name="projectId" defaultValue={sp.project || ''}><option value="">{workspaceT('noProject')}</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    <label className="block"><span className="mb-2 block text-sm text-slate-300">{c('title')}</span><input className="lab-input" name="title" required/></label>
    <label className="block"><span className="mb-2 block text-sm text-slate-300">{t('rawText')}</span><textarea className="lab-input min-h-48" name="rawText" placeholder={t('rawPlaceholder')} required/></label>
    <label className="block"><span className="mb-2 block text-sm text-slate-300">{c('domain')} ({c('optional')})</span><input className="lab-input" name="domain"/></label>
    <button className="lab-button">{c('submit')}</button>
  </form></div>;
}
