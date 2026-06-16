import {getTranslations} from 'next-intl/server';
import {prisma} from '@/lib/db/prisma';
import {ProgressPanel} from '@/components/hypotheses/ProgressPanel';
import {ConditionCard} from '@/components/hypotheses/ConditionCard';
import {VisualSceneCards} from '@/components/visual-lab/VisualSceneCards';
import {AnimatedVisualLab} from '@/components/visual-lab/AnimatedVisualLab';
import {EngineeringVisualLab} from '@/components/engineering/EngineeringVisualLab';
import {RegenerateEngineeringModelButton} from '@/components/engineering/RegenerateEngineeringModelButton';
import {CalculationCard} from '@/components/calculations/CalculationCard';
import {ParameterPlayground} from '@/components/calculations/ParameterPlayground';
import {LabLogTimeline} from '@/components/lab-log/LabLogTimeline';
import {SourceCandidateCard} from '@/components/sources/SourceCandidateCard';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {createMockAnalysisTranslation} from '@/lib/ai/analyze-hypothesis';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {getEnumLabel, getExperimentDifficultyLabel, getExperimentTypeLabel, getSafetyLevelLabel, getVerdictLevelLabel} from '@/lib/locale/enum-labels';
import {getLocalizedSourceSummary} from '@/lib/sources/source-discovery';
import {isParameterCalculationInput} from '@/lib/calculations/order-of-magnitude';
import {buildLabLog} from '@/lib/lab-log/build-lab-log';
import {buildVisualModel} from '@/lib/visual-lab/build-visual-model';
import {parseEngineeringModel} from '@/lib/engineering/engineering-model-schema';
import {enrichEngineeringModelContext, synthesizeEngineeringModelFallback} from '@/lib/engineering/generate-engineering-model';
import {runCalculationAction, runParameterCalculationAction} from '@/server/actions/calculations';
import {discoverSourcesAction} from '@/server/actions/sources';
import {regenerateEngineeringModelAction, resetEngineeringModelAction, updateEngineeringModelAction} from '@/server/actions/hypotheses';
import {getCurrentUser} from '@/lib/auth/current-user';
import {notFound, redirect} from 'next/navigation';

export default async function HypothesisPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  const t = await getTranslations('hypothesis');
  const v = await getTranslations('visual');
  const e = await getTranslations('experiments');
  const c = await getTranslations('common');
  const calc = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'calculations'});
  const sourceT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'sources'});
  const labT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'labLog'});
  const visualLabT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'visualLab'});
  const engineeringT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'engineeringLab'});
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const hypothesis = await prisma.hypothesis.findFirst({
    where: {id, ownerId: user.id},
    include: {
      analyses: {orderBy: {createdAt: 'desc'}, take: 1, include: {translations: true}},
      conditions: {orderBy: [{importance: 'asc'}, {createdAt: 'asc'}]},
      visualScenes: {take: 1, orderBy: {createdAt: 'desc'}},
      experiments: true,
      sources: {orderBy: {createdAt: 'desc'}},
      versions: true,
      simulationRuns: true,
      calculationRuns: {orderBy: {createdAt: 'desc'}, include: {condition: true}},
      breakthroughSessions: {where: {ownerId: user.id}, orderBy: {createdAt: 'desc'}},
    },
  });

  if (!hypothesis || !hypothesis.analyses[0]) notFound();
  const labLogItems = await buildLabLog({locale: locale === 'ru' ? 'ru' : 'en', hypothesisId: id});
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
    energyGap: calc('energyGap'),
    scaleGap: calc('scaleGap'),
    measurementFeasibility: calc('measurementFeasibility'),
    feasible: calc('feasible'),
    notFeasible: calc('notFeasible'),
    mainBlocker: calc('mainBlocker'),
    suggestedNextAction: calc('suggestedNextAction'),
    researchProgress: calc('researchProgress'),
    functionalityProgress: calc('functionalityProgress'),
    testabilityProgress: calc('testabilityProgress'),
    playground: {
      kicker: calc('playground.kicker'),
      title: calc('playground.title'),
      description: calc('playground.description'),
      objectScale: calc('playground.objectScale'),
      objectMassKg: calc('playground.objectMassKg'),
      objectSizeM: calc('playground.objectSizeM'),
      availableEnergyJ: calc('playground.availableEnergyJ'),
      requiredEnergyJ: calc('playground.requiredEnergyJ'),
      desiredEffect: calc('playground.desiredEffect'),
      observationTimeS: calc('playground.observationTimeS'),
      measurementSensitivity: calc('playground.measurementSensitivity'),
      sensitivityHelp: calc('playground.sensitivityHelp'),
      fieldIntensity: calc('playground.fieldIntensity'),
      notes: calc('playground.notes'),
      notesPlaceholder: calc('playground.notesPlaceholder'),
      run: calc('playground.run'),
      effects: {low: calc('playground.effects.low'), medium: calc('playground.effects.medium'), high: calc('playground.effects.high'), extreme: calc('playground.effects.extreme')},
    },
  };
  const latestParameterRun = hypothesis.calculationRuns.find(calculation => !calculation.breakthroughSessionId && isParameterCalculationInput(calculation.inputJson));
  const calculationHistory = latestParameterRun
    ? hypothesis.calculationRuns.filter(calculation => calculation.id !== latestParameterRun.id)
    : hypothesis.calculationRuns;
  const visualLabCalculations = hypothesis.calculationRuns.map(calculation => {
    const result = jsonRecord(calculation.resultJson);
    return {
      id: calculation.id,
      conditionId: calculation.conditionId,
      title: calculation.title,
      gapOrders: jsonNumber(result.gapOrders),
      gapLevel: jsonString(result.gapLevel),
      href: `/${locale}/hypotheses/${hypothesis.id}#calculations`,
    };
  });
  const visualLabConditions = conditions.map(condition => {
    const session = hypothesis.breakthroughSessions.find(item => item.conditionId === condition.id);
    return {
      id: condition.id,
      parentId: condition.parentId,
      title: condition.title,
      status: condition.status,
      importance: condition.importance,
      confidence: condition.confidence,
      completionScore: condition.completionScore,
      href: session ? `/${locale}/breakthroughs/${session.id}` : `/${locale}/hypotheses/${hypothesis.id}#condition-${condition.id}`,
    };
  });
  const visualLabSources = sources.map(source => ({
    id: source.id,
    conditionId: source.conditionId,
    title: source.title,
    relationship: source.relationshipToHypothesis,
    href: `/${locale}/hypotheses/${hypothesis.id}#sources`,
  }));
  const visualLabBreakthroughs = hypothesis.breakthroughSessions.map(session => ({
    id: session.id,
    conditionId: session.conditionId,
    title: localizeMockValue(session, locale).title,
    progressScore: session.progressScore,
    href: `/${locale}/breakthroughs/${session.id}`,
  }));
  const visualLabHypothesis = {
    id: hypothesis.id,
    title: hypothesis.originalTitle,
    progress: analysis.researchProgress,
    confidence: analysis.confidence,
    href: `/${locale}/hypotheses/${hypothesis.id}`,
  };
  const hiddenCount = Math.max(0, Number(buildVisualModel({
    locale,
    hypothesis: visualLabHypothesis,
    conditions: visualLabConditions,
    calculations: visualLabCalculations,
    sources: visualLabSources,
    breakthroughSessions: visualLabBreakthroughs,
  }).omittedCount ?? 0));
  const visualLabLabels = {
    kicker: visualLabT('kicker'), title: visualLabT('title'), description: visualLabT('description'),
    confidence: visualLabT('confidence'), gapOrders: visualLabT('gapOrders'), open: visualLabT('open'),
    more: visualLabT('more', {count: hiddenCount}), selected: visualLabT('selected'),
    nodeTypes: {
      hypothesis: visualLabT('nodeTypes.hypothesis'), condition: visualLabT('nodeTypes.condition'), blocker: visualLabT('nodeTypes.blocker'),
      calculation: visualLabT('nodeTypes.calculation'), source: visualLabT('nodeTypes.source'), breakthrough: visualLabT('nodeTypes.breakthrough'),
    },
    legend: {
      title: visualLabT('legend.title'), hypothesis: visualLabT('legend.hypothesis'), condition: visualLabT('legend.condition'),
      blocker: visualLabT('legend.blocker'), calculation: visualLabT('legend.calculation'), source: visualLabT('legend.source'),
      connection: visualLabT('legend.connection'), progress: visualLabT('legend.progress'),
    },
  };
  const engineeringInput = {
    locale,
    hypothesis: {
      id: hypothesis.id,
      title: hypothesis.originalTitle,
      text: hypothesis.originalText,
    },
    analysis: {
      summary: translation.summary,
      formalizedClaim: translation.formalizedClaim,
      knownScience: translation.knownScience,
      physicalConstraints: translation.physicalConstraints,
      engineeringConstraints: translation.engineeringConstraints,
      contradictions: translation.contradictions,
      unknowns: translation.unknowns,
      mainBlockers: analysis.mainBlockersJson,
      researchProgress: analysis.researchProgress,
      functionalityProgress: analysis.functionalityProgress,
      testabilityProgress: analysis.testabilityProgress,
      confidence: analysis.confidence,
    },
    conditions: conditions.map(condition => ({
      id: condition.id,
      title: condition.title,
      description: condition.description,
      status: condition.status,
      importance: condition.importance,
      completionScore: condition.completionScore,
      blockers: condition.blockers,
      parentId: condition.parentId,
    })),
    calculations: hypothesis.calculationRuns.map(calculation => ({
      id: calculation.id,
      conditionId: calculation.conditionId,
      title: calculation.title,
      resultJson: calculation.resultJson,
      gapOrders: jsonNumber(jsonRecord(calculation.resultJson).gapOrders),
    })),
    sources: sources.map(source => ({
      id: source.id,
      conditionId: source.conditionId,
      title: source.title,
      relationship: source.relationshipToHypothesis,
    })),
    experiments: experiments.map(experiment => ({
      id: experiment.id,
      title: experiment.title,
    })),
    breakthroughSessions: visualLabBreakthroughs.map(session => ({
      id: session.id,
      conditionId: session.conditionId,
      title: session.title,
      progressScore: session.progressScore,
    })),
  };
  const storedEngineeringModel = localeMatchesPrismaLocale(locale, hypothesis.analysisLocale)
    ? parseEngineeringModel(hypothesis.visualScenes[0]?.engineeringModelJson)
    : null;
  const engineeringModel = storedEngineeringModel
    ? enrichEngineeringModelContext(storedEngineeringModel, engineeringInput)
    : synthesizeEngineeringModelFallback(engineeringInput);
  const engineeringLabels = {
    kicker: engineeringT('kicker'), title: engineeringT('title'), description: engineeringT('description'),
    artifactType: engineeringT('artifactType'), explodedView: engineeringT('explodedView'), assembledView: engineeringT('assembledView'),
    resetCamera: engineeringT('resetCamera'), selectedModule: engineeringT('selectedModule'), moduleProgress: engineeringT('moduleProgress'),
    linkedBlockers: engineeringT('linkedBlockers'), linkedCalculations: engineeringT('linkedCalculations'), sourceCandidates: engineeringT('sourceCandidates'),
    activeBreakthroughs: engineeringT('activeBreakthroughs'), noLinkedItems: engineeringT('noLinkedItems'), open: engineeringT('open'),
    gapOrders: engineeringT('gapOrders'), criticalModules: engineeringT('criticalModules'), charts: engineeringT('charts'), mobileHint: engineeringT('mobileHint'),
    abstractNotice: engineeringT('abstractNotice'), nextEngineeringStep: engineeringT('nextEngineeringStep'), engineeringIntent: engineeringT('engineeringIntent'),
    severity: {
      info: engineeringT('severity.info'), success: engineeringT('severity.success'), warning: engineeringT('severity.warning'), critical: engineeringT('severity.critical'),
    },
    metrics: {
      research: engineeringT('metrics.research'), functionality: engineeringT('metrics.functionality'), testability: engineeringT('metrics.testability'),
      confidence: engineeringT('metrics.confidence'), evidence: engineeringT('metrics.evidence'),
    },
    editor: {
      viewMode: engineeringT('editor.viewMode'), editMode: engineeringT('editor.editMode'), warning: engineeringT('editor.warning'),
      save: engineeringT('editor.save'), saving: engineeringT('editor.saving'), cancel: engineeringT('editor.cancel'),
      addModule: engineeringT('editor.addModule'), newModuleName: engineeringT('editor.newModuleName'), newModuleRole: engineeringT('editor.newModuleRole'), newOverlayTitle: engineeringT('editor.newOverlayTitle'),
      deleteModule: engineeringT('editor.deleteModule'), deleteModuleDisabled: engineeringT('editor.deleteModuleDisabled'),
      moduleName: engineeringT('editor.moduleName'), moduleRole: engineeringT('editor.moduleRole'), moduleDescription: engineeringT('editor.moduleDescription'),
      category: engineeringT('editor.category'), geometryHint: engineeringT('editor.geometryHint'), positionHint: engineeringT('editor.positionHint'),
      feasibility: engineeringT('editor.feasibility'), reset: engineeringT('editor.reset'), resetConfirm: engineeringT('editor.resetConfirm'),
      geometryPrimitives: engineeringT('editor.geometryPrimitives'), addPrimitive: engineeringT('editor.addPrimitive'), deletePrimitive: engineeringT('editor.deletePrimitive'),
      shape: engineeringT('editor.shape'), position: engineeringT('editor.position'), rotation: engineeringT('editor.rotation'), scale: engineeringT('editor.scale'),
      materialRole: engineeringT('editor.materialRole'), opacity: engineeringT('editor.opacity'),
      researchOverlays: engineeringT('editor.researchOverlays'), addOverlay: engineeringT('editor.addOverlay'), deleteOverlay: engineeringT('editor.deleteOverlay'),
      overlayTitle: engineeringT('editor.overlayTitle'), overlayType: engineeringT('editor.overlayType'), severityLabel: engineeringT('editor.severityLabel'), gapOrders: engineeringT('gapOrders'),
      severity: {
        info: engineeringT('severity.info'), success: engineeringT('severity.success'), warning: engineeringT('severity.warning'), critical: engineeringT('severity.critical'),
      },
      categoryLabels: {
        body: engineeringT('editor.categories.body'), cabin: engineeringT('editor.categories.cabin'), lift: engineeringT('editor.categories.lift'),
        propulsion: engineeringT('editor.categories.propulsion'), energy: engineeringT('editor.categories.energy'), control: engineeringT('editor.categories.control'),
        thermal: engineeringT('editor.categories.thermal'), safety: engineeringT('editor.categories.safety'), sensor: engineeringT('editor.categories.sensor'),
        material: engineeringT('editor.categories.material'), measurement: engineeringT('editor.categories.measurement'), unknown: engineeringT('editor.categories.unknown'),
      },
      geometryHintLabels: {
        body: engineeringT('editor.geometryHints.body'), cabin: engineeringT('editor.geometryHints.cabin'), wing: engineeringT('editor.geometryHints.wing'),
        rotor: engineeringT('editor.geometryHints.rotor'), thruster: engineeringT('editor.geometryHints.thruster'), battery_pack: engineeringT('editor.geometryHints.battery_pack'),
        control_core: engineeringT('editor.geometryHints.control_core'), heat_sink: engineeringT('editor.geometryHints.heat_sink'), sensor_array: engineeringT('editor.geometryHints.sensor_array'),
        shield: engineeringT('editor.geometryHints.shield'), frame: engineeringT('editor.geometryHints.frame'), cell_stack: engineeringT('editor.geometryHints.cell_stack'), generic: engineeringT('editor.geometryHints.generic'),
      },
      positionHintLabels: {
        center: engineeringT('editor.positions.center'), front: engineeringT('editor.positions.front'), rear: engineeringT('editor.positions.rear'),
        left: engineeringT('editor.positions.left'), right: engineeringT('editor.positions.right'), top: engineeringT('editor.positions.top'),
        bottom: engineeringT('editor.positions.bottom'), internal: engineeringT('editor.positions.internal'), external: engineeringT('editor.positions.external'),
      },
      shapeLabels: {
        box: engineeringT('editor.shapes.box'), rounded_box: engineeringT('editor.shapes.rounded_box'), sphere: engineeringT('editor.shapes.sphere'),
        cylinder: engineeringT('editor.shapes.cylinder'), cone: engineeringT('editor.shapes.cone'), torus: engineeringT('editor.shapes.torus'),
        disc: engineeringT('editor.shapes.disc'), ring: engineeringT('editor.shapes.ring'), wing: engineeringT('editor.shapes.wing'),
        curved_blade: engineeringT('editor.shapes.curved_blade'), panel: engineeringT('editor.shapes.panel'), capsule: engineeringT('editor.shapes.capsule'),
        tube: engineeringT('editor.shapes.tube'), lattice: engineeringT('editor.shapes.lattice'), cell_stack: engineeringT('editor.shapes.cell_stack'),
      },
      materialRoleLabels: {
        body: engineeringT('editor.materialRoles.body'), glass: engineeringT('editor.materialRoles.glass'), energy: engineeringT('editor.materialRoles.energy'),
        thermal: engineeringT('editor.materialRoles.thermal'), control: engineeringT('editor.materialRoles.control'), propulsion: engineeringT('editor.materialRoles.propulsion'),
        sensor: engineeringT('editor.materialRoles.sensor'), shield: engineeringT('editor.materialRoles.shield'), structure: engineeringT('editor.materialRoles.structure'), unknown: engineeringT('editor.materialRoles.unknown'),
      },
      overlayTypeLabels: {
        blocker: engineeringT('editor.overlayTypes.blocker'), calculation: engineeringT('editor.overlayTypes.calculation'), source: engineeringT('editor.overlayTypes.source'),
        experiment: engineeringT('editor.overlayTypes.experiment'), breakthrough: engineeringT('editor.overlayTypes.breakthrough'),
      },
    },
  };
  const labLogLabels = {
    title: labT('title'),
    workspaceTitle: labT('workspaceTitle'),
    events: labT('events'),
    details: labT('details'),
    noEvents: labT('noEvents'),
    sourceTypes: {
      hypothesis: labT('sourceTypes.hypothesis'), condition: labT('sourceTypes.condition'), breakthrough: labT('sourceTypes.breakthrough'),
      idea: labT('sourceTypes.idea'), calculation: labT('sourceTypes.calculation'), source: labT('sourceTypes.source'),
      experiment: labT('sourceTypes.experiment'), simulation: labT('sourceTypes.simulation'), system: labT('sourceTypes.system'),
    },
    severity: {
      info: labT('severity.info'), success: labT('severity.success'), warning: labT('severity.warning'), critical: labT('severity.critical'),
    },
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

      <section id="calculations">
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
        <div className="mt-4">
          <ParameterPlayground
            action={runParameterCalculationAction.bind(null, locale, hypothesis.id, undefined, undefined)}
            defaultScale={analysis.scale}
            labels={calculationLabels.playground}
            locale={locale}
          />
        </div>
        {latestParameterRun && (
          <div className="mt-6">
            <SectionHeader code="LATEST" title={calc('latestResult')} detail={getCalculationGapLabelFromRun(latestParameterRun.resultJson, locale)} />
            <div className="mt-4"><CalculationCard calculation={latestParameterRun} labels={calculationLabels} locale={locale} subject={hypothesis.originalTitle} /></div>
          </div>
        )}
        {calculationHistory.length ? (
          <div className="mt-6">
            <SectionHeader code="HISTORY" title={calc('runHistory')} detail={`${calculationHistory.length} ${calc('history')}`} />
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {calculationHistory.map(calculation => {
              const calculationCondition = calculation.condition ? localizeMockValue(calculation.condition, locale) : null;
              return <CalculationCard calculation={calculation} labels={calculationLabels} locale={locale} subject={calculationCondition?.title || hypothesis.originalTitle} key={calculation.id} />;
            })}
          </div>
          </div>
        ) : (
          !latestParameterRun && <p className="mt-4 rounded-xl border border-dashed border-cyan-100/[0.1] px-5 py-4 text-xs text-[#78999b]">{calc('empty')}</p>
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
              <div id={`condition-${condition.id}`} key={condition.id}>
                <ConditionCard condition={condition} locale={locale} labels={labels} index={index} />
              </div>
            ))}
          </div>
        </GlassPanel>
      </section>

      <section id="visual-lab">
        <AnimatedVisualLab
          breakthroughSessions={visualLabBreakthroughs}
          calculations={visualLabCalculations}
          conditions={visualLabConditions}
          hypothesis={visualLabHypothesis}
          labels={visualLabLabels}
          locale={locale}
          sources={visualLabSources}
        />
      </section>

      <section aria-label={t('tabs.engineering')} id="engineering-model">
        <div className="mb-4 flex justify-end">
          <form action={regenerateEngineeringModelAction.bind(null, locale, hypothesis.id)}>
            <RegenerateEngineeringModelButton idleLabel={engineeringT('regenerate')} pendingLabel={engineeringT('regenerating')} />
          </form>
        </div>
        <EngineeringVisualLab
          actions={{
            update: updateEngineeringModelAction.bind(null, locale, hypothesis.id),
            reset: resetEngineeringModelAction.bind(null, locale, hypothesis.id),
          }}
          labels={engineeringLabels}
          model={engineeringModel}
          records={{
            conditions: visualLabConditions.map(item => ({id: item.id, title: item.title, href: item.href})),
            calculations: visualLabCalculations.map(item => ({id: item.id, title: item.title, href: item.href})),
            sources: visualLabSources.map(item => ({id: item.id, title: item.title, href: item.href})),
            experiments: experiments.map(item => ({id: item.id, title: item.title, href: `/${locale}/hypotheses/${hypothesis.id}#experiments`})),
            breakthroughs: visualLabBreakthroughs.map(item => ({id: item.id, conditionId: item.conditionId, title: item.title, href: item.href})),
          }}
        />
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

      <section id="sources">
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

      <section>
        <LabLogTimeline items={labLogItems} locale={locale} labels={labLogLabels} />
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

function getCalculationGapLabelFromRun(resultJson: unknown, locale: string): string {
  if (!resultJson || typeof resultJson !== 'object' || Array.isArray(resultJson)) return '—';
  const gapLevel = (resultJson as {gapLevel?: unknown}).gapLevel;
  return typeof gapLevel === 'string' ? getEnumLabel(gapLevel, locale) : '—';
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function jsonString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function localeMatchesPrismaLocale(locale: string, analysisLocale: string): boolean {
  return (locale.toLowerCase() === 'ru' ? 'RU' : 'EN') === analysisLocale;
}
