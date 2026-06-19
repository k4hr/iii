import Link from 'next/link';
import {GlassPanel} from '@/components/ui/GlassPanel';

export type ResearchFlowItem = {
  href: string;
  label: string;
  state: 'done' | 'active' | 'blocked' | 'empty';
};

const stateStyles: Record<ResearchFlowItem['state'], string> = {
  done: 'border-emerald-300/20 text-emerald-100/75',
  active: 'border-cyan-300/25 text-cyan-100/80',
  blocked: 'border-rose-300/25 text-rose-100/75',
  empty: 'border-cyan-100/[0.08] text-cyan-100/38',
};

export function HypothesisResearchFlow({items, title}: {items: ResearchFlowItem[]; title: string}) {
  return (
    <GlassPanel className="p-4">
      <div className="section-kicker">{title}</div>
      <div className="mt-4 grid gap-2 md:grid-cols-4 xl:grid-cols-7">
        {items.map((item, index) => (
          <Link className={`relative rounded-xl border bg-black/20 px-3 py-3 font-mono text-[9px] tracking-[.08em] uppercase transition-colors hover:border-cyan-100/35 hover:text-cyan-50 ${stateStyles[item.state]}`} href={item.href} key={item.label}>
            <span className="mr-2 text-cyan-100/25">{String(index + 1).padStart(2, '0')}</span>{item.label}
          </Link>
        ))}
      </div>
    </GlassPanel>
  );
}
