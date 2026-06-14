import {GlassPanel} from '@/components/ui/GlassPanel';
import {LabMetricCard} from '@/components/ui/LabMetricCard';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {getHypothesisOverallStatusLabel, getRealityGapLevelLabel} from '@/lib/locale/enum-labels';

export function ProgressPanel({analysis, blockers, locale, t}: {analysis: any; blockers: string[]; locale: string; t: (key: string) => string}) {
  const ru = locale === 'ru';

  return (
    <GlassPanel glow className="data-grid p-3 sm:p-5">
      <div className="flex flex-col justify-between gap-4 border-b border-cyan-100/[0.08] px-2 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="section-kicker">{ru ? 'Телеметрия готовности модели' : 'Model readiness telemetry'}</div>
          <h2 className="mt-3 text-xl font-semibold text-cyan-50">{ru ? 'Панель научной состоятельности' : 'Scientific viability command panel'}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={analysis.overallStatus} locale={locale} label={getHypothesisOverallStatusLabel(analysis.overallStatus, locale)} />
          <StatusBadge value={analysis.realityGap} locale={locale} label={`${t('realityGap')}: ${getRealityGapLevelLabel(analysis.realityGap, locale)}`} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <LabMetricCard label={t('researchProgress')} value={analysis.researchProgress} detail={ru ? 'Полнота доказательств, формализации и известных научных данных' : 'Evidence, formalization and known-science coverage'} />
        <LabMetricCard label={t('functionalityProgress')} value={analysis.functionalityProgress} detail={ru ? 'Инженерная дистанция до работающей системы' : 'Engineering distance to an operational result'} />
        <LabMetricCard label={t('testabilityProgress')} value={analysis.testabilityProgress} detail={ru ? 'Готовность получить измеримый подтверждающий или опровергающий сигнал' : 'Ability to produce a measurable pass or fail signal'} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[.7fr_1.3fr]">
        <div className="rounded-2xl border border-cyan-100/[0.08] bg-black/35 p-5">
          <div className="mono-label">{t('nextBestAction')}</div>
          <p className="mt-3 text-sm leading-6 text-cyan-50">{t('nextBestActionValue')}</p>
          <div className="mt-5 h-px bg-gradient-to-r from-cyan-200/20 to-transparent" />
          <div className="mt-4 flex items-center justify-between text-xs text-[#628587]">
            <span>{t('overallStatus')}</span>
            <span className="font-mono text-cyan-100/75">{Math.round((analysis.confidence || 0) * 100)}% {t('confidence')}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-red-300/[0.1] bg-black/30 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="mono-label text-red-200/55">{t('mainBlockers')}</div>
            <span className="font-mono text-[10px] text-red-200/35">{blockers.length.toString().padStart(2, '0')} {ru ? 'КРИТИЧЕСКИХ УЗЛА' : 'CRITICAL NODES'}</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {blockers.length ? blockers.map((blocker, index) => (
              <div className="critical-card p-4" key={blocker}>
                <div className="font-mono text-[9px] tracking-[.12em] text-red-300/45">{ru ? 'БЛОКЕР' : 'BLOCKER'} {String(index + 1).padStart(2, '0')}</div>
                <p className="mt-2 text-xs leading-5 text-red-50/80">{blocker}</p>
              </div>
            )) : <p className="text-sm text-[#628587]">{ru ? 'Критические блокеры не обнаружены.' : 'No critical blockers recorded.'}</p>}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
