import Link from 'next/link';

export type HypothesisModuleSeverity = 'info' | 'success' | 'warning' | 'critical';

const severityStyles: Record<HypothesisModuleSeverity, string> = {
  info: 'border-cyan-200/15 bg-cyan-300/[0.025]',
  success: 'border-emerald-200/15 bg-emerald-300/[0.025]',
  warning: 'border-amber-200/20 bg-amber-300/[0.035]',
  critical: 'border-rose-200/25 bg-rose-300/[0.04]',
};

const dotStyles: Record<HypothesisModuleSeverity, string> = {
  info: 'bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,.55)]',
  success: 'bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,.55)]',
  warning: 'bg-amber-300 shadow-[0_0_16px_rgba(251,191,36,.55)]',
  critical: 'bg-rose-300 shadow-[0_0_16px_rgba(251,113,133,.55)]',
};

export type HypothesisModuleCardItem = {
  id: string;
  count?: string;
  cta: string;
  description: string;
  href: string;
  lastUpdated?: string;
  severity?: HypothesisModuleSeverity;
  status?: string;
  title: string;
};

export function HypothesisModuleCard({
  active,
  count,
  cta,
  description,
  href,
  lastUpdated,
  severity = 'info',
  status,
  title,
}: HypothesisModuleCardItem & {active?: boolean}) {
  return (
    <Link className={`group relative overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-100/30 hover:bg-cyan-200/[0.045] ${severityStyles[severity]} ${active ? 'ring-1 ring-cyan-200/35' : ''}`} href={href}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,.12),transparent_42%)] opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotStyles[severity]}`} />
          <span className="font-mono text-[9px] tracking-[.12em] text-cyan-100/45 uppercase">{status}</span>
        </div>
        {count && <span className="font-mono text-xl font-light text-cyan-100/75">{count}</span>}
      </div>
      <h3 className="relative mt-4 text-sm font-semibold tracking-[-.02em] text-cyan-50">{title}</h3>
      <p className="relative mt-2 min-h-10 text-[10px] leading-5 text-cyan-50/45">{description}</p>
      <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-cyan-100/[0.07] pt-3">
        <span className="font-mono text-[9px] tracking-[.1em] text-cyan-200/55 uppercase">{cta}</span>
        {lastUpdated && <span className="text-[9px] text-cyan-100/30">{lastUpdated}</span>}
      </div>
    </Link>
  );
}
