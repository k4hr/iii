import Link from 'next/link';
import {getTranslations} from 'next-intl/server';
import {prisma} from '@/lib/db/prisma';
import {createProjectAction} from '@/server/actions/hypotheses';
import {getCurrentUser} from '@/lib/auth/current-user';
import {redirect} from 'next/navigation';

export default async function Projects({params}: {params: Promise<{locale:string}>}) {
  const {locale}=await params; const t=await getTranslations('projects'); const c=await getTranslations('common');
  const user=await getCurrentUser();
  if(!user) redirect(`/${locale}/login`);
  const projects=await prisma.project.findMany({where:{ownerId:user.id}, orderBy:{createdAt:'desc'}, include:{_count:{select:{hypotheses:{where:{ownerId:user.id}}}}}});
  return <div className="space-y-8"><h1 className="text-4xl font-black">{t('title')}</h1>
  <form action={createProjectAction.bind(null, locale)} className="lab-card grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto]"><input className="lab-input" name="title" placeholder={t('newTitle')}/><input className="lab-input" name="description" placeholder={c('description')}/><button className="lab-button">{c('createProject')}</button></form>
  <div className="grid gap-4 md:grid-cols-3">{projects.map(p=><Link className="lab-card p-5" href={`/${locale}/projects/${p.id}`} key={p.id}><h2 className="font-bold">{p.title}</h2><p className="mt-2 text-sm text-slate-400">{p.description}</p><div className="mt-4 badge">{p._count.hypotheses} {c('hypotheses').toLowerCase()}</div></Link>)}</div></div>;
}
