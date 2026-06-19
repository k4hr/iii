import Link from 'next/link';
import type {ReactNode} from 'react';

export function HypothesisSummaryHero({
  badges,
  breadcrumbs,
  createdAt,
  createdLabel,
  owner,
  privacy,
  summary,
  title,
  workspaceLabel,
}: {
  badges: ReactNode;
  breadcrumbs: Array<{href: string; label: string}>;
  createdAt: string;
  createdLabel: string;
  owner: string;
  privacy: string;
  summary: string;
  title: string;
  workspaceLabel: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-[2rem] border border-cyan-100/[0.1] bg-[#020708]/90 p-5 shadow-[0_0_90px_rgba(24,215,203,.06)] sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(16,185,129,.1),transparent_32%)]" />
      <div className="relative">
        <nav className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[.08em] text-cyan-100/40 uppercase">
          {breadcrumbs.map((item, index) => (
            <span className="flex items-center gap-2" key={item.href}>
              {index > 0 && <span className="text-cyan-100/20">/</span>}
              <Link className="hover:text-cyan-100" href={item.href}>{item.label}</Link>
            </span>
          ))}
        </nav>
        <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <div className="section-kicker">{workspaceLabel}</div>
            <h1 className="mt-4 max-w-5xl text-4xl font-semibold tracking-[-.045em] text-white sm:text-5xl lg:text-6xl">{title}</h1>
            <p className="mt-5 max-w-4xl text-sm leading-7 text-[#8eabad] sm:text-base">{summary}</p>
          </div>
          <div className="space-y-3 lg:min-w-72">
            <div className="flex flex-wrap gap-2 lg:justify-end">{badges}</div>
            <div className="rounded-2xl border border-cyan-100/[0.08] bg-black/25 p-4">
              <div className="grid gap-3 text-xs text-cyan-50/62">
                <HeroMeta label={privacy} value={owner} />
                <HeroMeta label={createdLabel} value={createdAt} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroMeta({label, value}: {label: string; value: string}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[9px] tracking-[.1em] text-cyan-100/35 uppercase">{label}</span>
      <span className="text-right text-cyan-50/72">{value}</span>
    </div>
  );
}
