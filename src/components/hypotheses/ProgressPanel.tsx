import {GlassPanel} from '@/components/ui/GlassPanel';
import {LabMetricCard} from '@/components/ui/LabMetricCard';
import {StatusBadge} from '@/components/ui/StatusBadge';

export function ProgressPanel({analysis, t}: {analysis: any; t: (key: string) => string}) {
  const blockers = Array.isArray(analysis.mainBlockersJson) ? analysis.mainBlockersJson : [];

  return (
    <GlassPanel glow className="data-grid p-3 sm:p-5">
      <div className="flex flex-col justify-between gap-4 border-b border-cyan-100/[0.08] px-2 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="section-kicker">Model readiness telemetry</div>
          <h2 className="mt-3 text-xl font-semibold text-cyan-50">Scientific viability command panel</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={analysis.overallStatus} />
          <StatusBadge value={analysis.realityGap} label={`${t('realityGap')}: ${analysis.realityGap.replaceAll('_', ' ')}`} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <LabMetricCard label={t('researchProgress')} value={analysis.researchProgress} detail="Evidence, formalization and known-science coverage" />
        <LabMetricCard label={t('functionalityProgress')} value={analysis.functionalityProgress} detail="Engineering distance to an operational result" />
        <LabMetricCard label={t('testabilityProgress')} value={analysis.testabilityProgress} detail="Ability to produce a measurable pass or fail signal" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[.7fr_1.3fr]">
        <div className="rounded-2xl border border-cyan-100/[0.08] bg-black/35 p-5">
          <div className="mono-label">{t('nextBestAction')}</div>
          <p className="mt-3 text-sm leading-6 text-cyan-50">Reduce to smallest testable version</p>
          <div className="mt-5 h-px bg-gradient-to-r from-cyan-200/20 to-transparent" />
          <div className="mt-4 flex items-center justify-between text-xs text-[#628587]">
            <span>{t('overallStatus')}</span>
            <span className="font-mono text-cyan-100/75">{analysis.confidence ? `${Math.round(analysis.confidence * 100)}% confidence` : 'Model active'}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-red-300/[0.1] bg-black/30 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="mono-label text-red-200/55">{t('mainBlockers')}</div>
            <span className="font-mono text-[10px] text-red-200/35">{blockers.length.toString().padStart(2, '0')} CRITICAL NODES</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {blockers.length ? blockers.map((blocker: string, index: number) => (
              <div className="critical-card p-4" key={blocker}>
                <div className="font-mono text-[9px] tracking-[.12em] text-red-300/45">BLOCKER {String(index + 1).padStart(2, '0')}</div>
                <p className="mt-2 text-xs leading-5 text-red-50/80">{blocker}</p>
              </div>
            )) : <p className="text-sm text-[#628587]">No critical blockers recorded.</p>}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
