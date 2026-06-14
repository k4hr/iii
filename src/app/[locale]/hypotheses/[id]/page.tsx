import {getTranslations} from 'next-intl/server';
import {prisma} from '@/lib/db/prisma';
import {ProgressPanel} from '@/components/hypotheses/ProgressPanel';
import {ConditionCard} from '@/components/hypotheses/ConditionCard';
import {VisualSceneCards} from '@/components/visual-lab/VisualSceneCards';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {StatusBadge} from '@/components/ui/StatusBadge';

export default async function HypothesisPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  const t = await getTranslations('hypothesis');
  const v = await getTranslations('visual');
  const e = await getTranslations('experiments');
  const c = await getTranslations('common');
  const hypothesis = await prisma.hypothesis.findUnique({
    where: {id},
    include: {
      analyses: {orderBy: {createdAt: 'desc'}, take: 1, include: {translations: true}},
      conditions: {orderBy: [{importance: 'asc'}, {createdAt: 'asc'}]},
      visualScenes: {take: 1, orderBy: {createdAt: 'desc'}},
      experiments: true,
      sources: true,
      versions: true,
      simulationRuns: true,
    },
  });

  if (!hypothesis || !hypothesis.analyses[0]) return <div>Not found</div>;
  const analysis = hypothesis.analyses[0];
  const translation = analysis.translations.find(item => item.locale.toLowerCase() === locale) || analysis.translations[0];
  const labels = {progress: c('progress'), known: t('known'), unknown: t('unknown'), blockers: t('blockers'), conflicts: t('conflicts'), ifSolved: t('ifSolved'), testMethod: t('testMethod'), start: c('startBreakthrough')};
  const minimalExperiments = Array.isArray(translation?.minimalExperiments) ? translation.minimalExperiments : [];

  return (
    <div className="space-y-10 py-3">
      <header className="grid gap-8 border-b border-cyan-100/[0.08] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="section-kicker">{t('workspace')}</div>
          <h1 className="mt-5 max-w-5xl text-4xl font-semibold tracking-[-.045em] text-white sm:text-5xl lg:text-6xl">{hypothesis.originalTitle}</h1>
          <p className="mt-5 max-w-4xl text-sm leading-7 text-[#8eabad] sm:text-base">{translation?.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
          <StatusBadge value={hypothesis.status} />
          <StatusBadge value={analysis.verdictLevel} />
          <span className="status-badge status-badge--neutral">{analysis.scale}</span>
        </div>
      </header>

      <ProgressPanel analysis={analysis} t={(key) => t(key)} />

      <section className="grid gap-4 lg:grid-cols-[1.12fr_.88fr]">
        <GlassPanel className="p-6 sm:p-7">
          <div className="section-kicker">{t('tabs.overview')}</div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-cyan-50">{translation?.formalizedClaim}</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <DataPoint label="Target" value={translation?.targetObject} />
            <DataPoint label={c('status')} value={analysis.verdictLevel.replaceAll('_', ' ')} />
            <DataPoint label={t('pathToTestability')} value={minimalExperiments.map(String).join(' · ')} wide />
          </div>
        </GlassPanel>
        <GlassPanel className="data-grid p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="section-kicker">{t('tabs.model')}</div>
            <span className="font-mono text-[9px] tracking-[.13em] text-emerald-300/55">CANONICAL JSON</span>
          </div>
          <pre className="terminal-text mt-5 max-h-80 overflow-auto rounded-xl border border-cyan-100/[0.08] bg-black/50 p-4 text-[11px] leading-5 text-cyan-100/65">{JSON.stringify(analysis.canonicalJson, null, 2)}</pre>
        </GlassPanel>
      </section>

      <section>
        <SectionHeader code="DEP-01" title={t('tabs.breakthrough')} detail={`${hypothesis.conditions.length} ${t('conditions').toLowerCase()}`} />
        <GlassPanel className="data-grid mt-5 p-4 sm:p-6">
          <div className="relative space-y-3 lg:ml-5 lg:border-l lg:border-cyan-200/15 lg:pl-8">
            {hypothesis.conditions.map((condition, index) => (
              <ConditionCard key={condition.id} condition={condition} locale={locale} labels={labels} index={index} />
            ))}
          </div>
        </GlassPanel>
      </section>

      {hypothesis.visualScenes[0] && (
        <section>
          <SectionHeader code="VIS-02" title={t('tabs.visual')} detail={`${hypothesis.visualScenes[0].scale} scale`} />
          <div className="mt-5">
            <VisualSceneCards scene={hypothesis.visualScenes[0]} labels={{objects: v('objects'), variables: v('variables'), constraints: v('constraints'), measurements: v('measurements')}} />
          </div>
        </section>
      )}

      <section>
        <SectionHeader code="EXP-03" title={t('tabs.experiments')} detail={`${hypothesis.experiments.length} protocols`} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {hypothesis.experiments.map((experiment, index) => (
            <GlassPanel className="p-5" key={experiment.id}>
              <div className="flex items-start justify-between gap-4">
                <span className="mono-label">Protocol {String(index + 1).padStart(2, '0')}</span>
                <div className="flex flex-wrap justify-end gap-2"><StatusBadge value={experiment.experimentType} /><StatusBadge value={experiment.safetyLevel} /></div>
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

      <section className="grid gap-4 md:grid-cols-3">
        <SystemCounter title={t('tabs.simulations')} value={hypothesis.simulationRuns.length} />
        <SystemCounter title={t('tabs.sources')} value={hypothesis.sources.length} />
        <SystemCounter title={t('tabs.versions')} value={hypothesis.versions.length} />
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

function SystemCounter({title, value}: {title: string; value: number}) {
  return <GlassPanel className="flex items-center justify-between p-5"><div><div className="mono-label">Data channel</div><h3 className="mt-2 text-sm font-semibold text-cyan-50">{title}</h3></div><div className="font-mono text-3xl font-light text-cyan-200/75">{String(value).padStart(2, '0')}</div></GlassPanel>;
}
