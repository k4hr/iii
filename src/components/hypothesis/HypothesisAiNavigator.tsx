import type {ReactNode} from 'react';
import {GlassPanel} from '@/components/ui/GlassPanel';

type NavigatorSeverity = 'info' | 'success' | 'warning' | 'critical';

const severityStyles: Record<NavigatorSeverity, string> = {
  info: 'border-cyan-200/15 bg-cyan-300/[0.025] text-cyan-100/70',
  success: 'border-emerald-200/15 bg-emerald-300/[0.03] text-emerald-100/75',
  warning: 'border-amber-200/20 bg-amber-300/[0.035] text-amber-100/75',
  critical: 'border-rose-200/25 bg-rose-300/[0.045] text-rose-100/80',
};

const dotStyles: Record<NavigatorSeverity, string> = {
  info: 'bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,.55)]',
  success: 'bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,.55)]',
  warning: 'bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,.55)]',
  critical: 'bg-rose-300 shadow-[0_0_18px_rgba(251,113,133,.55)]',
};

export type HypothesisNavigatorSignal = {
  label: string;
  value: string;
  severity?: NavigatorSeverity;
};

export function HypothesisAiNavigator({
  actions,
  labels,
  mainBlocker,
  missingData,
  recommendation,
  signals,
}: {
  actions: ReactNode;
  labels: {
    currentState: string;
    mainBlocker: string;
    missingData: string;
    noData: string;
    quickActions: string;
    recommendation: string;
    title: string;
  };
  mainBlocker?: string;
  missingData: string[];
  recommendation: {title: string; reason: string};
  signals: HypothesisNavigatorSignal[];
}) {
  return (
    <aside className="relative overflow-hidden rounded-[1.5rem] border border-cyan-100/[0.1] bg-[#020708]/90 p-4 shadow-[0_0_70px_rgba(20,184,166,.045)] lg:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_0%,rgba(34,211,238,.13),transparent_38%)]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="section-kicker">{labels.title}</div>
            <h2 className="mt-2 text-lg font-semibold tracking-[-.03em] text-cyan-50">{labels.recommendation}</h2>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.06] font-mono text-xs text-cyan-100/65">
            AI
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-100/[0.08] bg-black/25 p-4">
          <div className="font-mono text-[9px] tracking-[.12em] text-cyan-100/40 uppercase">{labels.recommendation}</div>
          <h3 className="mt-2 text-sm font-semibold text-cyan-50">{recommendation.title}</h3>
          <p className="mt-2 text-xs leading-5 text-[#8aa5a8]">{recommendation.reason}</p>
        </div>

        <div className="mt-4">
          <div className="font-mono text-[9px] tracking-[.12em] text-cyan-100/40 uppercase">{labels.currentState}</div>
          <div className="mt-3 grid gap-2">
            {signals.map(signal => (
              <div className={`rounded-xl border px-3 py-2 ${severityStyles[signal.severity ?? 'info']}`} key={signal.label}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-mono text-[9px] tracking-[.1em] uppercase">
                    <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[signal.severity ?? 'info']}`} />
                    {signal.label}
                  </span>
                  <span className="text-xs">{signal.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-100/[0.08] bg-black/20 p-4">
          <div className="font-mono text-[9px] tracking-[.12em] text-cyan-100/40 uppercase">{labels.mainBlocker}</div>
          <p className="mt-2 text-xs leading-5 text-cyan-50/70">{mainBlocker || labels.noData}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-100/[0.08] bg-black/20 p-4">
          <div className="font-mono text-[9px] tracking-[.12em] text-cyan-100/40 uppercase">{labels.missingData}</div>
          {missingData.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {missingData.map(item => (
                <span className="rounded-full border border-amber-200/15 bg-amber-300/[0.045] px-2.5 py-1 font-mono text-[9px] tracking-[.08em] text-amber-100/70 uppercase" key={item}>
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-cyan-50/55">{labels.noData}</p>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-3 font-mono text-[9px] tracking-[.12em] text-cyan-100/40 uppercase">{labels.quickActions}</div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      </div>
    </aside>
  );
}
