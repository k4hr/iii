import Link from 'next/link';
import {prisma} from '@/lib/db/prisma';
import {getTranslations} from 'next-intl/server';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {getCurrentUser} from '@/lib/auth/current-user';
import {notFound, redirect} from 'next/navigation';

export default async function ProjectPage({params}: {params: Promise<{locale:string; id:string}>}) {
  const {locale,id}=await params;
  const c=await getTranslations('common');
  const user=await getCurrentUser();
  if(!user) redirect(`/${locale}/account`);
  const project=await prisma.project.findFirst({where:{id,ownerId:user.id}, include:{hypotheses:{where:{ownerId:user.id},include:{analyses:{take:1,orderBy:{createdAt:'desc'}}}}, breakthroughSessions:{where:{ownerId:user.id}}}});
  if(!project) notFound();
  return <div className="space-y-6"><div className="lab-card p-6"><h1 className="text-4xl font-black">{project.title}</h1><p className="mt-2 text-slate-400">{project.description}</p><Link className="lab-button mt-5" href={`/${locale}/hypotheses/new?project=${project.id}`}>{c('newHypothesis')}</Link></div>
  <section><h2 className="mb-3 text-2xl font-bold">{c('hypotheses')}</h2><div className="grid gap-4 md:grid-cols-2">{project.hypotheses.map(h=><Link key={h.id} href={`/${locale}/hypotheses/${h.id}`} className="lab-card p-5"><div className="font-bold">{h.originalTitle}</div><div className="mt-3"><StatusBadge value={h.status} locale={locale}/></div></Link>)}</div></section>
  </div>;
}
