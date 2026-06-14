import {getTranslations} from 'next-intl/server';
import {prisma} from '@/lib/db/prisma';
import {ProgressPanel} from '@/components/hypotheses/ProgressPanel';
import {ConditionCard} from '@/components/hypotheses/ConditionCard';
import {VisualSceneCards} from '@/components/visual-lab/VisualSceneCards';
import {CalculationCard} from '@/components/calculations/CalculationCard';
import {SourceCandidateCard} from '@/components/sources/SourceCandidateCard';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {createMockAnalysisTranslation} from '@/lib/ai/analyze-hypothesis';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {getEnumLabel, getExperimentDifficultyLabel, getExperimentTypeLabel, getSafetyLevelLabel, getVerdictLevelLabel} from '@/lib/locale/enum-labels';
import {getLocalizedSourceSummary} from '@/lib/sources/source-discovery';
import {runCalculationAction} from '@/server/actions/calculations';
import {discoverSourcesAction} from '@/server/actions/sources';

export default async function HypothesisPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  const t = await getTranslations('hypothesis');
  const v = await getTranslations('visual');
  const e = await getTranslations('experiments');
  const c = await getTranslations('common');
  const calc = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'calculations'});
  const sourceT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'sources'});
  const hypothesis = await prisma.hypothesis.findUnique({
    where: {id},
    include: {
      analyses: {orderBy: {createdAt: 'desc'}, take: 1, include: {translations: true}},
      conditions: {orderBy: [{importance: 'asc'}, {createdAt: 'asc'}]},
      visualScenes: {take: 1, orderBy: {createdAt: 'desc'}},
      experiments: true,
      sources: {orderBy: {createdAt: 'desc'}},
      versions: true,
      simulationRuns: true,
      calculationRuns: {orderBy: {createdAt: 'desc'}, include: {condition: true}},
    },
  });

  if (!hypothesis || !hypothesis.analyses[0]) return <div>Not found</div>;
  const analysis = hypothesis.analyses[0];
  const translation = createMockAnalysisTranslation({title: hypothesis.originalTitle, text: hypothesis.originalText, locale});
  const conditions = hypothesis.conditions.map(condition => localizeMockValue(condition, locale));
  const experiments = hypothesis.experiments.map(experiment => localizeMockValue(experiment, locale));
  const visualScene = hypothesis.visualScenes[0] ? localizeMockValue(hypothesis.visualScenes[0], locale) : null;
  const sources = hypothesis.sources.map(source => ({...source, summary: getLocalizedSourceSummary(source, locale)}));
  const blockers = conditions.filter(condition => condition.importance === 'CRITICAL').map(condition => condition.title).slice(0, 3);
  const labels = {progress: c('progress'), known: t('known'), unknown: t('unknown'), blockers: t('blockers'), conflicts: t('conflicts'), ifSolved: t('ifSolved'), testMethod: t('testMethod'), start: c('startBreakthrough')};
  const minimalExperiments = Array.isArray(translation?.minimalExperiments) ? translation.minimalExperiments : [];
  const calculationLabels = {
    inputs: calc('inputs'),
    result: calc('result'),
    required: calc('required'),
    available: calc('available'),
    ratio: calc('ratio'),
    orders: calc('orders'),
    preliminary: calc('preliminary'),
  };

  return (
    <div className="space-y-10 py-3">
      <header className="grid gap-8 border-b border-cyan-100/[0.08] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="section-kicker">{t('workspace')}</div>
          <h1 className="mt-5 max-w-5xl text-4xl font-semibold tracking-[-.045em] text-white sm:text-5xl lg:text-6xl">{hypothesis.originalTitle}</h1>
          <p className="mt-5 max-w-4xl text-sm leading-7 text-[#8eabad] sm:text-base">{translation?.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
          <StatusBadge value={hypothesis.status} locale={locale} />
          <StatusBadge value={analysis.verdictLevel} locale={locale} label={getVerdictLevelLabel(analysis.verdictLevel, locale)} />
          <span className="status-badge status-badge--neutral">{getEnumLabel(analysis.scale, locale)}</span>
        </div>
      </header>

      <ProgressPanel analysis={analysis} blockers={blockers} locale={locale} t={(key) => t(key)} />

      <section>
        <SectionHeader code="CALC-01" title={calc('title')} detail={`${hypothesis.calculationRuns.length} ${calc('history')}`} />
        <GlassPanel glow className="data-grid mt-5 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="section-kicker">ORDER-OF-MAGNITUDE V1</div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#91adaf]">{calc('description')}</p>
            </div>
            <form action={runCalculationAction.bind(null, locale, hypothesis.id, undefined, undefined)}>
              <GlowButton>{calc('run')}</GlowButton>
            </form>
          </div>
          <div className="mt-6 grid gap-3 border-t border-cyan-100/[0.07] pt-5 md:grid-cols-2 xl:grid-cols-3">
            {conditions.map(condition => (
              <form action={runCalculationAction.bind(null, locale, hypothesis.id, condition.id, undefined)} className="flex items-center justify-between gap-4 rounded-xl border border-cyan-100/[0.07] bg-black/25 p-4" key={condition.id}>
                <span className="text-xs leading-5 text-cyan-50/75">{condition.title}</span>
                <GlowButton className="shrink-0" variant="quiet">{calc('runForCondition')}</GlowButton>
              </form>
            ))}
          </div>
        </GlassPanel>
        {hypothesis.calculationRuns.length ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {hypothesis.calculationRuns.map(calculation => {
              const calculationCondition = calculation.condition ? localizeMockValue(calculation.condition, locale) : null;
              return <CalculationCard calculation={calculation} labels={calculationLabels} locale={locale} subject={calculationCondition?.title || hypothesis.originalTitle} key={calculation.id} />;
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-cyan-100/[0.1] px-5 py-4 text-xs text-[#78999b]">{calc('empty')}</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.12fr_.88fr]">
        <GlassPanel className="p-6 sm:p-7">
          <div className="section-kicker">{t('tabs.overview')}</div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-cyan-50">{translation?.formalizedClaim}</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <DataPoint label={t('target')} value={translation.targetObject} />
            <DataPoint label={c('status')} value={getVerdictLevelLabel(analysis.verdictLevel, locale)} />
            <DataPoint label={t('pathToTestability')} value={minimalExperiments.map(String).join(' · ')} wide />
          </div>
        </GlassPanel>
        <GlassPanel className="data-grid p-6 sm:p-7">
          <details>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-4">
                <div><div className="section-kicker">{t('technicalModel')}</div><p className="mt-3 text-xs leading-5 text-[#78999b]">{t('technicalModelHelp')}</p></div>
                <span className="font-mono text-[9px] tracking-[.13em] text-emerald-300/55">JSON</span>
              </div>
            </summary>
            <pre className="terminal-text mt-5 max-h-80 overflow-auto rounded-xl border border-cyan-100/[0.08] bg-black/50 p-4 text-[11px] leading-5 text-cyan-100/65">{JSON.stringify(analysis.canonicalJson, null, 2)}</pre>
          </details>
        </GlassPanel>
      </section>

      <section>
        <SectionHeader code="DEP-01" title={t('tabs.breakthrough')} detail={`${conditions.length} ${t('conditions').toLowerCase()}`} />
        <GlassPanel className="data-grid mt-5 p-4 sm:p-6">
          <div className="relative space-y-3 lg:ml-5 lg:border-l lg:border-cyan-200/15 lg:pl-8">
            {conditions.map((condition, index) => (
              <ConditionCard key={condition.id} condition={condition} locale={locale} labels={labels} index={index} />
            ))}
          </div>
        </GlassPanel>
      </section>

      {visualScene && (
        <section>
          <SectionHeader code="VIS-02" title={t('tabs.visual')} detail={getEnumLabel(visualScene.scale, locale)} />
          <div className="mt-5">
            <VisualSceneCards scene={visualScene} labels={{objects: v('objects'), variables: v('variables'), constraints: v('constraints'), measurements: v('measurements')}} />
          </div>
        </section>
      )}

      <section>
        <SectionHeader code="EXP-03" title={t('tabs.experiments')} detail={`${experiments.length} ${locale === 'ru' ? 'протокола' : 'protocols'}`} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {experiments.map((experiment, index) => (
            <GlassPanel className="p-5" key={experiment.id}>
              <div className="flex items-start justify-between gap-4">
                <span className="mono-label">{locale === 'ru' ? 'Протокол' : 'Protocol'} {String(index + 1).padStart(2, '0')}</span>
                <div className="flex flex-wrap justify-end gap-2"><StatusBadge value={experiment.experimentType} locale={locale} label={getExperimentTypeLabel(experiment.experimentType, locale)} /><StatusBadge value={experiment.difficulty} locale={locale} label={getExperimentDifficultyLabel(experiment.difficulty, locale)} /><StatusBadge value={experiment.safetyLevel} locale={locale} label={getSafetyLevelLabel(experiment.safetyLevel, locale)} /></div>
              </div>
              <h3 className="mt-6 font-semibold text-cyan-50">{experiment.title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#769799]">{experiment.description}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DataPoint label={e('signal')} value={experiment.expectedSignal} />
                <DataPoint label={e('falsification')} value={experiment.falsificationCriteria} />
              </div>
            </GlassPanel>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><div className="mono-label">SRC-04</div><h2 className="section-heading mt-2">{sourceT('title')}</h2><p className="mt-3 max-w-3xl text-xs leading-6 text-[#78999b]">{sourceT('description')}</p></div>
          <form action={discoverSourcesAction.bind(null, locale, hypothesis.id, undefined)}>
            <GlowButton>{sourceT('discover')}</GlowButton>
          </form>
        </div>
        {sources.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {sources.map(source => <SourceCandidateCard source={source} summary={source.summary} locale={locale} labels={{candidate: sourceT('candidate'), openSearch: sourceT('openSearch')}} key={source.id} />)}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-cyan-100/[0.1] px-5 py-4 text-xs text-[#78999b]">{sourceT('empty')}</p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SystemCounter title={t('tabs.simulations')} value={hypothesis.simulationRuns.length} locale={locale} />
        <SystemCounter title={t('tabs.sources')} value={sources.length} locale={locale} />
        <SystemCounter title={t('tabs.versions')} value={hypothesis.versions.length} locale={locale} />
      </section>
    </div>
  );
}

function SectionHeader({code, title, detail}: {code: string; title: string; detail: string}) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mono-label">{code}</div><h2 className="section-heading mt-2">{title}</h2></div><span className="font-mono text-[10px] tracking-[.12em] text-cyan-200/35 uppercase">{detail}</span></div>;
}

function DataPoint({label, value, wide = false}: {label: string; value?: string | null; wide?: boolean}) {
  return <div className={`border-l border-cyan-200/20 pl-4 ${wide ? 'sm:col-span-2' : ''}`}><div className="mono-label">{label}</div><p className="mt-2 text-xs leading-6 text-[#a5bdbf]">{value || '—'}</p></div>;
}

function SystemCounter({title, value, locale = 'en'}: {title: string; value: number; locale?: string}) {
  return <GlassPanel className="flex items-center justify-between p-5"><div><div className="mono-label">{locale === 'ru' ? 'Канал данных' : 'Data channel'}</div><h3 className="mt-2 text-sm font-semibold text-cyan-50">{title}</h3></div><div className="font-mono text-3xl font-light text-cyan-200/75">{String(value).padStart(2, '0')}</div></GlassPanel>;
}
