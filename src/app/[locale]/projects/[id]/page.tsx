import Link from 'next/link';
import {prisma} from '@/lib/db/prisma';
import {getTranslations} from 'next-intl/server';
import {StatusBadge} from '@/components/ui/StatusBadge';

export default async function ProjectPage({params}: {params: Promise<{locale:string; id:string}>}) {
  const {locale,id}=await params;
  const c=await getTranslations('common');
  const project=await prisma.project.findUnique({where:{id}, include:{hypotheses:{include:{analyses:{take:1,orderBy:{createdAt:'desc'}}}}, breakthroughSessions:true}});
  if(!project) return <div>Not found</div>;
  return <div className="space-y-6"><div className="lab-card p-6"><h1 className="text-4xl font-black">{project.title}</h1><p className="mt-2 text-slate-400">{project.description}</p><Link className="lab-button mt-5" href={`/${locale}/hypotheses/new?project=${project.id}`}>{c('newHypothesis')}</Link></div>
  <section><h2 className="mb-3 text-2xl font-bold">{c('hypotheses')}</h2><div className="grid gap-4 md:grid-cols-2">{project.hypotheses.map(h=><Link key={h.id} href={`/${locale}/hypotheses/${h.id}`} className="lab-card p-5"><div className="font-bold">{h.originalTitle}</div><div className="mt-3"><StatusBadge value={h.status} locale={locale}/></div></Link>)}</div></section>
  </div>;
}
