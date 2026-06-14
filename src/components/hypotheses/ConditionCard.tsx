import {startBreakthroughAction} from '@/server/actions/hypotheses';
import {GlowButton} from '@/components/ui/GlowButton';
import {ProgressBar} from '@/components/ui/ProgressBar';
import {StatusBadge} from '@/components/ui/StatusBadge';

export function ConditionCard({condition, locale, labels, index = 0}: {condition: any; locale: string; labels: Record<string, string>; index?: number}) {
  return (
    <details className="group relative rounded-2xl border border-cyan-100/[0.1] bg-[#041012]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.03)] open:border-cyan-200/20" open={condition.importance === 'CRITICAL'}>
      <span className="absolute -left-[1.43rem] top-7 hidden h-3 w-3 rounded-full border-2 border-[#071315] bg-cyan-300 shadow-[0_0_14px_#43f1df] lg:block" />
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex gap-4">
            <span className="font-mono text-[10px] tracking-[.14em] text-cyan-200/35">NODE {String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3 className="text-base font-semibold leading-6 text-cyan-50">{condition.title}</h3>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-[#78999b]">{condition.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <StatusBadge value={condition.status} />
            <StatusBadge value={condition.importance} />
            <span className="status-badge status-badge--neutral">{Math.round(condition.confidence)}% confidence</span>
          </div>
        </div>
      </summary>

      <div className="mt-6 border-t border-cyan-100/[0.07] pt-5">
        <ProgressBar value={condition.completionScore} label={labels.progress} />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <DataBlock title={labels.known} body={condition.knownWhat} tone="positive" />
          <DataBlock title={labels.unknown} body={condition.unknownWhat} tone="warning" />
          <DataList title={labels.blockers} items={condition.blockers} tone="critical" />
          <DataList title={labels.conflicts} items={condition.conflicts} tone="critical" />
          <DataList title={labels.ifSolved} items={Object.entries(condition.ifSolvedImpactJson || {}).map(([key, value]) => `${key}: ${String(value)}`)} tone="positive" />
          <DataBlock title={labels.testMethod} body={condition.testMethod} tone="neutral" />
        </div>
        <form action={startBreakthroughAction.bind(null, locale, condition.id)} className="mt-5 flex justify-end">
          <GlowButton>{labels.start}</GlowButton>
        </form>
      </div>
    </details>
  );
}

function DataBlock({title, body, tone}: {title: string; body?: string | null; tone: string}) {
  return (
    <div className={`rounded-xl border p-4 ${toneClass(tone)}`}>
      <div className="font-mono text-[9px] tracking-[.12em] uppercase opacity-60">{title}</div>
      <p className="mt-2 text-xs leading-5 text-[#abc3c4]">{body || '—'}</p>
    </div>
  );
}

function DataList({title, items, tone}: {title: string; items: any; tone: string}) {
  const values = Array.isArray(items) ? items : [];
  return (
    <div className={`rounded-xl border p-4 ${toneClass(tone)}`}>
      <div className="font-mono text-[9px] tracking-[.12em] uppercase opacity-60">{title}</div>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[#abc3c4]">
        {values.length ? values.map((value: unknown, index: number) => <li key={index} className="flex gap-2"><span className="opacity-50">›</span>{String(value)}</li>) : <li>—</li>}
      </ul>
    </div>
  );
}

function toneClass(tone: string) {
  if (tone === 'critical') return 'border-red-300/[0.12] bg-red-400/[0.025] text-red-200';
  if (tone === 'positive') return 'border-emerald-300/[0.12] bg-emerald-400/[0.025] text-emerald-200';
  if (tone === 'warning') return 'border-amber-300/[0.12] bg-amber-400/[0.025] text-amber-200';
  return 'border-cyan-100/[0.08] bg-black/25 text-cyan-200';
}
