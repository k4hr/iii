import Link from 'next/link';
import {prisma} from '@/lib/db/prisma';
import {getTranslations} from 'next-intl/server';

export default async function Hypotheses({params}: {params: Promise<{locale:string}>}) {
  const {locale}=await params; const c=await getTranslations('common');
  const hypotheses=await prisma.hypothesis.findMany({orderBy:{createdAt:'desc'}, include:{analyses:{take:1,orderBy:{createdAt:'desc'}}}});
  return <div className="space-y-6"><div className="flex justify-between"><h1 className="text-4xl font-black">{c('hypotheses')}</h1><Link className="lab-button" href={`/${locale}/hypotheses/new`}>{c('newHypothesis')}</Link></div><div className="grid gap-4 md:grid-cols-2">{hypotheses.map(h=><Link href={`/${locale}/hypotheses/${h.id}`} className="lab-card p-5" key={h.id}><h2 className="font-bold">{h.originalTitle}</h2><p className="mt-2 line-clamp-2 text-sm text-slate-400">{h.originalText}</p><div className="mt-4 flex gap-2"><span className="badge">{h.status}</span>{h.analyses[0]&&<span className="badge">Reality {h.analyses[0].functionalityProgress}%</span>}</div></Link>)}</div></div>
}
