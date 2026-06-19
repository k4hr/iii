import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import type {ReactNode} from 'react';
import {prisma} from '@/lib/db/prisma';
import {ConditionCard} from '@/components/hypotheses/ConditionCard';
import {EngineeringVisualLab} from '@/components/engineering/EngineeringVisualLab';
import {RegenerateEngineeringModelButton} from '@/components/engineering/RegenerateEngineeringModelButton';
import {CalculationCard} from '@/components/calculations/CalculationCard';
import {ParameterPlayground} from '@/components/calculations/ParameterPlayground';
import {ExperimentPlanCard, type ExperimentPlanLabels} from '@/components/experiments/ExperimentPlanCard';
import {LabLogTimeline} from '@/components/lab-log/LabLogTimeline';
import {SourceCandidateCard} from '@/components/sources/SourceCandidateCard';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {HypothesisActiveSection} from '@/components/hypothesis/HypothesisActiveSection';
import {HypothesisAiNavigator, type HypothesisNavigatorSignal} from '@/components/hypothesis/HypothesisAiNavigator';
import {HypothesisCockpitHeader} from '@/components/hypothesis/HypothesisCockpitHeader';
import {HypothesisCockpitShell} from '@/components/hypothesis/HypothesisCockpitShell';
import {HypothesisCommandPalette} from '@/components/hypothesis/HypothesisCommandPalette';
import {HypothesisModuleCards, type HypothesisModuleItem} from '@/components/hypothesis/HypothesisModuleCards';
import {HypothesisProgressStrip} from '@/components/hypothesis/HypothesisProgressStrip';
import {HypothesisQuickActions} from '@/components/hypothesis/HypothesisQuickActions';
import {HypothesisResearchFlow, type ResearchFlowItem} from '@/components/hypothesis/HypothesisResearchFlow';
import {NextBestActionPanel} from '@/components/hypothesis/NextBestActionPanel';
import {PendingActionButton} from '@/components/hypothesis/PendingActionButton';
import {ResearchMissionControl, type ResearchMissionControlTask} from '@/components/hypothesis/ResearchMissionControl';
import {createMockAnalysisTranslation} from '@/lib/ai/analyze-hypothesis';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {getEnumLabel, getExperimentDifficultyLabel, getExperimentTypeLabel, getSafetyLevelLabel, getVerdictLevelLabel} from '@/lib/locale/enum-labels';
import {getLocalizedSourceSummary} from '@/lib/sources/source-discovery';
import {isParameterCalculationInput} from '@/lib/calculations/order-of-magnitude';
import {buildLabLog} from '@/lib/lab-log/build-lab-log';
import {parseEngineeringModel} from '@/lib/engineering/engineering-model-schema';
import {enrichEngineeringModelContext, synthesizeEngineeringModelFallback} from '@/lib/engineering/generate-engineering-model';
import {runCalculationAction, runParameterCalculationAction} from '@/server/actions/calculations';
import {discoverSourcesAction} from '@/server/actions/sources';
import {generateExperimentAction} from '@/server/actions/experiments';
import {regenerateEngineeringModelAction, resetEngineeringModelAction, startBreakthroughAction, updateEngineeringModelAction} from '@/server/actions/hypotheses';
import {syncResearchMissionAction} from '@/server/actions/workflow';
import {getCurrentUser} from '@/lib/auth/current-user';
import {syncResearchTasksForHypothesis, type ResearchMissionTask} from '@/lib/workflow/research-mission-control';
import {notFound, redirect} from 'next/navigation';

type HypothesisSection = 'overview' | 'engineering' | 'map' | 'calculations' | 'sources' | 'experiments' | 'breakthroughs' | 'lab-log' | 'versions';

const sectionIds: HypothesisSection[] = ['overview', 'engineering', 'map', 'calculations', 'sources', 'experiments', 'breakthroughs', 'lab-log', 'versions'];

export default async function HypothesisPage({params, searchParams}: {params: Promise<{locale: string; id: string}>; searchParams?: Promise<{section?: string}>}) {
  const {locale, id} = await params;
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations('hypothesis');
    const e = await getTranslations('experiments');
  const c = await getTranslations('common');
  const calc = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'calculations'});
  const sourceT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'sources'});
  const labT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'labLog'});
  const engineeringT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'engineeringLab'});
  const cockpitT = await getTranslations({locale: locale === 'ru' ? 'ru' : 'en', namespace: 'hypothesis.cockpitV2'});
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const hypothesis = await prisma.hypothesis.findFirst({
    where: {id, ownerId: user.id},
    include: {
      analyses: {orderBy: {createdAt: 'desc'}, take: 1, include: {translations: true}},
      conditions: {orderBy: [{importance: 'asc'}, {createdAt: 'asc'}]},
      visualScenes: {take: 1, orderBy: {createdAt: 'desc'}},
      experiments: {orderBy: {createdAt: 'desc'}},
      sources: {orderBy: {createdAt: 'desc'}},
      versions: true,
      simulationRuns: true,
      calculationRuns: {orderBy: {createdAt: 'desc'}, include: {condition: true}},
      breakthroughSessions: {where: {ownerId: user.id}, orderBy: {createdAt: 'desc'}},
      project: {select: {id: true, title: true}},
    },
  });

  if (!hypothesis || !hypothesis.analyses[0]) notFound();
  const mission = await syncResearchTasksForHypothesis({locale, hypothesisId: id, ownerId: user.id});
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
  const experimentPlanLabels: ExperimentPlanLabels = {
    cost: e('cost'),
    dataToCollect: e('dataToCollect'),
    difficulty: e('difficulty'),
    expectedResult: e('expectedResult'),
    experimentGoal: e('experimentGoal'),
    falsification: e('falsification'),
    measurements: e('measurements'),
    minimumViableTest: e('minimumViableTest'),
    procedure: e('procedure'),
    risks: e('risks'),
    safety: e('safety'),
    setup: e('setup'),
    successCriteria: e('successCriteria'),
    variables: e('variables'),
    whatWeTest: e('whatWeTest'),
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
  const selectedSection = sectionIds.includes(resolvedSearchParams?.section as HypothesisSection)
    ? resolvedSearchParams?.section as HypothesisSection
    : 'overview';
  const sectionHref = (section: HypothesisSection) => `/${locale}/hypotheses/${hypothesis.id}?section=${section}`;
  const criticalConditions = conditions.filter(condition => condition.importance === 'CRITICAL');
  const highConditions = conditions.filter(condition => condition.importance === 'HIGH');
  const otherConditions = conditions.filter(condition => condition.importance !== 'CRITICAL' && condition.importance !== 'HIGH');
  const primaryBlocker = criticalConditions[0] ?? conditions[0];
  const primarySession = primaryBlocker ? hypothesis.breakthroughSessions.find(session => session.conditionId === primaryBlocker.id) : null;
  const hasPersistedEngineeringModel = Boolean(storedEngineeringModel);
  const latestLabEvent = labLogItems[0];
  const weakestProgress = [
    {label: t('researchProgress'), value: analysis.researchProgress},
    {label: t('functionalityProgress'), value: analysis.functionalityProgress},
    {label: t('testabilityProgress'), value: analysis.testabilityProgress},
  ].sort((left, right) => left.value - right.value)[0];
  const createdAt = formatDate(hypothesis.createdAt, locale);
  const latestActivity = latestLabEvent ? `${latestLabEvent.title} · ${formatDate(latestLabEvent.timestamp, locale)}` : cockpitT('noData');
  const latestEngineeringActivity = hypothesis.visualScenes[0]?.createdAt ? formatDate(hypothesis.visualScenes[0].createdAt, locale) : cockpitT('noData');
  const engineeringPrimitiveCount = engineeringModel.geometryPlan.primitives.length;
  const latestCalculationGap = hypothesis.calculationRuns[0] ? getCalculationGapLabelFromRun(hypothesis.calculationRuns[0].resultJson, locale) : cockpitT('noData');
  const missionTasks = mission.tasks.map(task => toMissionTaskView({
    task,
    conditionId: task.conditionId,
    hypothesisId: hypothesis.id,
    labels: {pending: cockpitT('pending'), openTask: cockpitT('openTask')},
    locale,
    sectionHref,
  }));
  const currentMissionTask = mission.currentTask
    ? missionTasks.find(task => task.id === mission.currentTask?.id)
    : undefined;
  const nextMissionTaskViews = mission.nextTasks
    .map(task => missionTasks.find(item => item.id === task.id))
    .filter((task): task is ResearchMissionControlTask => Boolean(task));
  const missionTaskByType = new Map(missionTasks.map(task => [task.type, task]));
  const fallbackNextAction = chooseNextAction({
    calculationCount: hypothesis.calculationRuns.length,
    criticalCondition: criticalConditions[0],
    experimentCount: experiments.length,
    hasPersistedEngineeringModel,
    hypothesisId: hypothesis.id,
    locale,
    primarySessionId: primarySession?.id,
    sectionHref,
    sourceCount: sources.length,
    cockpitT,
  });
  const nextAction = currentMissionTask
    ? {title: currentMissionTask.title, reason: currentMissionTask.description, action: currentMissionTask.action || <GlowButton href={currentMissionTask.href}>{currentMissionTask.actionLabel}</GlowButton>}
    : fallbackNextAction;
  const navigatorMissingData = mission.nextTasks.length
    ? mission.nextTasks.map(task => task.title)
    : [cockpitT('noData')];
  const navigatorSignals: HypothesisNavigatorSignal[] = [
    {
      label: cockpitT('engineering'),
      value: hasPersistedEngineeringModel ? cockpitT('ready') : cockpitT('missing'),
      severity: hasPersistedEngineeringModel ? 'success' : 'warning',
    },
    {
      label: cockpitT('calculations'),
      value: String(hypothesis.calculationRuns.length).padStart(2, '0'),
      severity: hypothesis.calculationRuns.length ? 'success' : 'warning',
    },
    {
      label: cockpitT('sources'),
      value: String(sources.length).padStart(2, '0'),
      severity: sources.length ? 'success' : 'warning',
    },
    {
      label: cockpitT('mainBlocker'),
      value: String(criticalConditions.length).padStart(2, '0'),
      severity: criticalConditions.length ? 'critical' : 'info',
    },
  ];
  const researchFlow: ResearchFlowItem[] = [
    {label: cockpitT('flow.formalization'), href: sectionHref('overview'), state: 'done'},
    {label: cockpitT('flow.map'), href: sectionHref('map'), state: criticalConditions.length ? 'blocked' : conditions.length ? 'done' : 'empty'},
    {label: cockpitT('flow.engineering'), href: sectionHref('engineering'), state: hasPersistedEngineeringModel ? 'done' : 'active'},
    {label: cockpitT('flow.calculations'), href: sectionHref('calculations'), state: hypothesis.calculationRuns.length ? 'done' : 'empty'},
    {label: cockpitT('flow.sources'), href: sectionHref('sources'), state: sources.length ? 'done' : 'empty'},
    {label: cockpitT('flow.breakthrough'), href: sectionHref('breakthroughs'), state: hypothesis.breakthroughSessions.length ? 'active' : criticalConditions.length ? 'blocked' : 'empty'},
    {label: cockpitT('flow.experiment'), href: sectionHref('experiments'), state: experiments.length ? 'done' : 'empty'},
  ];
  const moduleCards: HypothesisModuleItem[] = [
    {
      id: 'overview',
      title: cockpitT('overview'),
      description: cockpitT('overviewDescription'),
      href: sectionHref('overview'),
      cta: cockpitT('openSection'),
      count: `${Math.round(analysis.confidence)}%`,
      status: t('confidence'),
      severity: analysis.realityGap === 'EXTREME' ? 'warning' : 'success',
      lastUpdated: latestActivity,
    },
    {
      id: 'engineering',
      title: cockpitT('engineering'),
      description: cockpitT('engineeringDescription'),
      href: sectionHref('engineering'),
      cta: hasPersistedEngineeringModel ? cockpitT('open') : cockpitT('regenerateModel'),
      count: `${String(engineeringModel.physicalModules.length).padStart(2, '0')}/${String(engineeringPrimitiveCount).padStart(2, '0')}`,
      status: cockpitT('modulePrimitiveStatus'),
      severity: hasPersistedEngineeringModel ? 'success' : 'warning',
      lastUpdated: latestEngineeringActivity,
    },
    {
      id: 'map',
      title: cockpitT('map'),
      description: cockpitT('breakthroughDescription'),
      href: sectionHref('map'),
      cta: cockpitT('goTo'),
      count: String(criticalConditions.length).padStart(2, '0'),
      status: cockpitT('mainBlocker'),
      severity: criticalConditions.length ? 'critical' : 'info',
    },
    {
      id: 'calculations',
      title: cockpitT('calculations'),
      description: cockpitT('calculationsDescription'),
      href: sectionHref('calculations'),
      cta: hypothesis.calculationRuns.length ? cockpitT('open') : cockpitT('runCalculation'),
      count: String(hypothesis.calculationRuns.length).padStart(2, '0'),
      status: latestCalculationGap,
      severity: hypothesis.calculationRuns.length ? 'success' : 'warning',
    },
    {
      id: 'sources',
      title: cockpitT('sources'),
      description: cockpitT('sourcesDescription'),
      href: sectionHref('sources'),
      cta: sources.length ? cockpitT('open') : cockpitT('discoverSources'),
      count: String(sources.length).padStart(2, '0'),
      status: sourceT('candidate'),
      severity: sources.length ? 'success' : 'warning',
    },
    {
      id: 'experiments',
      title: cockpitT('experiments'),
      description: cockpitT('experimentsDescription'),
      href: sectionHref('experiments'),
      cta: cockpitT('openSection'),
      count: String(experiments.length).padStart(2, '0'),
      status: e('title'),
      severity: experiments.length ? 'success' : 'info',
    },
    {
      id: 'breakthroughs',
      title: cockpitT('activeBreakthroughs'),
      description: cockpitT('activeBreakthroughsDescription'),
      href: sectionHref('breakthroughs'),
      cta: cockpitT('goTo'),
      count: String(hypothesis.breakthroughSessions.length).padStart(2, '0'),
      status: c('progress'),
      severity: hypothesis.breakthroughSessions.length ? 'success' : 'info',
    },
    {
      id: 'lab-log',
      title: cockpitT('labLog'),
      description: cockpitT('labLogDescription'),
      href: sectionHref('lab-log'),
      cta: cockpitT('inspectLabLog'),
      count: String(labLogItems.length).padStart(2, '0'),
      status: cockpitT('latestActivity'),
      severity: 'info',
    },
    {
      id: 'versions',
      title: cockpitT('versions'),
      description: cockpitT('versionsDescription'),
      href: sectionHref('versions'),
      cta: cockpitT('openSection'),
      count: String(hypothesis.versions.length).padStart(2, '0'),
      status: t('tabs.versions'),
      severity: 'info',
    },
  ];

  return (
    <HypothesisCockpitShell
      stickyNav={
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-2 overflow-x-auto">
            {moduleCards.map(module => (
              <Link className={`shrink-0 rounded-xl border px-3 py-2 font-mono text-[9px] tracking-[.08em] uppercase ${module.id === selectedSection ? 'border-cyan-200/40 bg-cyan-300/10 text-cyan-50' : 'border-cyan-100/[0.08] bg-black/25 text-cyan-100/45 hover:text-cyan-100'}`} href={module.href} key={module.id}>
                {module.title}
              </Link>
            ))}
          </div>
          <HypothesisCommandPalette
            actions={{
              discoverSources: discoverSourcesAction.bind(null, locale, hypothesis.id, undefined),
              generateExperiment: generateExperimentAction.bind(null, locale, hypothesis.id, primaryBlocker?.id, primarySession?.id),
              regenerateModel: regenerateEngineeringModelAction.bind(null, locale, hypothesis.id),
              runCalculation: runCalculationAction.bind(null, locale, hypothesis.id, undefined, undefined),
              ...(primaryBlocker?.id ? {startBreakthrough: startBreakthroughAction.bind(null, locale, primaryBlocker.id)} : {}),
              syncMission: syncResearchMissionAction.bind(null, locale, hypothesis.id),
            }}
            labels={{
              commandPalette: cockpitT('commandPalette'),
              copied: cockpitT('copied'),
              copyLink: cockpitT('copyLink'),
              discoverSources: cockpitT('discoverSources'),
              generateExperiment: e('generate'),
              openCalculations: cockpitT('openCalculations'),
              openCurrentObjective: cockpitT('openCurrentObjective'),
              openEngineeringModel: cockpitT('openEngineeringModel'),
              openLabLog: cockpitT('openLabLog'),
              pending: cockpitT('pending'),
              pressShortcut: cockpitT('pressShortcut'),
              regenerateModel: cockpitT('regenerateModel'),
              runCalculation: cockpitT('runCalculation'),
              searchPlaceholder: cockpitT('searchCommands'),
              startBreakthrough: cockpitT('startBreakthrough'),
              syncMission: cockpitT('syncMission'),
            }}
            links={{
              calculations: sectionHref('calculations'),
              currentObjective: currentMissionTask?.href || sectionHref('overview'),
              engineering: sectionHref('engineering'),
              labLog: sectionHref('lab-log'),
            }}
          />
        </div>
      }
    >
      <HypothesisCockpitHeader
        badges={<>
          <StatusBadge value={hypothesis.status} locale={locale} />
          <StatusBadge value={analysis.verdictLevel} locale={locale} label={getVerdictLevelLabel(analysis.verdictLevel, locale)} />
          <span className="status-badge status-badge--neutral">{getEnumLabel(analysis.realityGap, locale)}</span>
          <span className="status-badge status-badge--neutral">{getEnumLabel(analysis.scale, locale)}</span>
        </>}
        breadcrumbs={[
          {href: `/${locale}/dashboard`, label: c('dashboard')},
          ...(hypothesis.project ? [{href: `/${locale}/projects/${hypothesis.project.id}`, label: hypothesis.project.title}] : [{href: `/${locale}/projects`, label: c('projects')}]),
          {href: `/${locale}/hypotheses`, label: c('hypotheses')},
        ]}
        createdAt={createdAt}
        createdLabel={cockpitT('created')}
        mainBlocker={primaryBlocker?.title}
        mainBlockerLabel={cockpitT('mainBlocker')}
        owner={user.email || user.name || cockpitT('ownerContext')}
        privacy={cockpitT('privateWorkspace')}
        summary={translation?.summary || cockpitT('noData')}
        title={hypothesis.originalTitle}
        workspaceLabel={cockpitT('cockpit')}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_.72fr]">
        <HypothesisProgressStrip items={[{label: t('researchProgress'), value: analysis.researchProgress}, {label: t('functionalityProgress'), value: analysis.functionalityProgress}, {label: t('testabilityProgress'), value: analysis.testabilityProgress}]} />
        <HealthPanel labels={{health: cockpitT('health'), strongestBlocker: cockpitT('strongestBlocker'), weakestProgress: cockpitT('weakestProgress'), latestActivity: cockpitT('latestActivity'), noData: cockpitT('noData')}} latestActivity={latestActivity} strongestBlocker={primaryBlocker?.title} weakestProgress={weakestProgress.label + ': ' + Math.round(weakestProgress.value) + '%'} />
      </div>

      <ResearchMissionControl
        completedCount={mission.completedCount}
        criticalTodoCount={mission.criticalTodoCount}
        currentTask={currentMissionTask}
        labels={{
          completed: cockpitT('mission.completed'),
          criticalTask: cockpitT('mission.criticalTask'),
          currentObjective: cockpitT('mission.currentObjective'),
          done: cockpitT('mission.done'),
          inProgress: cockpitT('mission.inProgress'),
          mission: cockpitT('mission.title'),
          nextSteps: cockpitT('mission.nextSteps'),
          openTask: cockpitT('mission.openTask'),
          pending: cockpitT('mission.pending'),
          syncMission: cockpitT('mission.syncMission'),
        }}
        nextTasks={nextMissionTaskViews}
        progress={mission.progress}
        syncAction={<form action={syncResearchMissionAction.bind(null, locale, hypothesis.id)}><PendingActionButton className="rounded-xl border border-cyan-100/[0.1] bg-black/30 px-3 py-2 font-mono text-[9px] tracking-[.1em] text-cyan-100/55 uppercase" idleLabel={cockpitT('mission.syncMission')} pendingLabel={cockpitT('pending')} /></form>}
        totalCount={mission.tasks.length}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className="space-y-4">
          <NextBestActionPanel action={nextAction.action} kicker={cockpitT('nextAction')} mainBlocker={primaryBlocker?.title} mainBlockerLabel={cockpitT('mainBlocker')} reason={nextAction.reason} title={nextAction.title} />
          <QuickActions labels={{quickActions: cockpitT('quickActions'), runCalculation: cockpitT('runCalculation'), discoverSources: cockpitT('discoverSources'), startBreakthrough: cockpitT('startBreakthrough'), regenerateModel: cockpitT('regenerateModel'), openLabLog: cockpitT('openLabLog'), pending: cockpitT('pending')}} locale={locale} primaryBlockerId={primaryBlocker?.id} hypothesisId={hypothesis.id} labLogHref={sectionHref('lab-log')} />
        </div>
        <HypothesisAiNavigator
          actions={<>
            <form action={runCalculationAction.bind(null, locale, hypothesis.id, undefined, undefined)}><PendingActionButton idleLabel={cockpitT('runCalculation')} pendingLabel={cockpitT('pending')} /></form>
            <form action={discoverSourcesAction.bind(null, locale, hypothesis.id, undefined)}><PendingActionButton idleLabel={cockpitT('discoverSources')} pendingLabel={cockpitT('pending')} /></form>
            {primaryBlocker?.id && <form action={startBreakthroughAction.bind(null, locale, primaryBlocker.id)}><PendingActionButton idleLabel={cockpitT('startBreakthrough')} pendingLabel={cockpitT('pending')} /></form>}
            <form action={regenerateEngineeringModelAction.bind(null, locale, hypothesis.id)}><PendingActionButton idleLabel={cockpitT('regenerateModel')} pendingLabel={cockpitT('pending')} /></form>
            <GlowButton href={sectionHref('lab-log')} variant="quiet">{cockpitT('openLabLog')}</GlowButton>
          </>}
          labels={{
            currentState: cockpitT('currentState'),
            mainBlocker: cockpitT('mainBlocker'),
            missingData: cockpitT('missingData'),
            noData: cockpitT('noData'),
            quickActions: cockpitT('quickActions'),
            recommendation: cockpitT('recommendation'),
            title: cockpitT('aiNavigator'),
          }}
          mainBlocker={primaryBlocker?.title}
          missingData={navigatorMissingData}
          recommendation={{title: nextAction.title, reason: nextAction.reason}}
          signals={navigatorSignals}
        />
      </div>

      <HypothesisResearchFlow items={researchFlow} title={cockpitT('researchFlow')} />

      <HypothesisModuleCards activeSection={selectedSection} label={cockpitT('researchSections')} modules={moduleCards} />

      {selectedSection === 'overview' && (
        <HypothesisActiveSection code="OVR-01" description={cockpitT('overviewDescription')} title={cockpitT('summary')}>
          <div className="grid gap-4 lg:grid-cols-[1.12fr_.88fr]">
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
                <summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-4"><div><div className="section-kicker">{t('technicalModel')}</div><p className="mt-3 text-xs leading-5 text-[#78999b]">{t('technicalModelHelp')}</p></div><span className="font-mono text-[9px] tracking-[.13em] text-emerald-300/55">JSON</span></div></summary>
                <pre className="terminal-text mt-5 max-h-80 overflow-auto rounded-xl border border-cyan-100/[0.08] bg-black/50 p-4 text-[11px] leading-5 text-cyan-100/65">{JSON.stringify(analysis.canonicalJson, null, 2)}</pre>
              </details>
            </GlassPanel>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <MiniData label={cockpitT('mainBlocker')} value={primaryBlocker?.title || cockpitT('noData')} />
            <MiniData label={cockpitT('weakestProgress')} value={weakestProgress.label + ': ' + Math.round(weakestProgress.value) + '%'} />
            <MiniData label={cockpitT('nextAction')} value={nextAction.title} />
            <MiniData label={cockpitT('latestActivity')} value={latestActivity} />
          </div>
        </HypothesisActiveSection>
      )}

      {selectedSection === 'engineering' && (
        <HypothesisActiveSection code="ENG-02" description={cockpitT('engineeringDescription')} title={cockpitT('engineering')}>
          <div className="mb-4 flex flex-wrap justify-end gap-2"><form action={regenerateEngineeringModelAction.bind(null, locale, hypothesis.id)}><RegenerateEngineeringModelButton idleLabel={engineeringT('regenerate')} pendingLabel={engineeringT('regenerating')} /></form></div>
          <EngineeringVisualLab actions={{update: updateEngineeringModelAction.bind(null, locale, hypothesis.id), reset: resetEngineeringModelAction.bind(null, locale, hypothesis.id)}} labels={engineeringLabels} model={engineeringModel} records={{conditions: visualLabConditions.map(item => ({id: item.id, title: item.title, href: item.href})), calculations: visualLabCalculations.map(item => ({id: item.id, title: item.title, href: item.href})), sources: visualLabSources.map(item => ({id: item.id, title: item.title, href: item.href})), experiments: experiments.map(item => ({id: item.id, title: item.title, href: `/${locale}/hypotheses/${hypothesis.id}?section=experiments`})), breakthroughs: visualLabBreakthroughs.map(item => ({id: item.id, conditionId: item.conditionId, title: item.title, href: item.href}))}} />
        </HypothesisActiveSection>
      )}

      {selectedSection === 'map' && <HypothesisActiveSection code="DEP-03" description={cockpitT('breakthroughDescription')} title={cockpitT('breakthrough')}><ConditionGroup conditions={criticalConditions} indexOffset={0} labels={labels} locale={locale} title={getEnumLabel('CRITICAL', locale)} /><ConditionGroup conditions={highConditions} indexOffset={criticalConditions.length} labels={labels} locale={locale} title={getEnumLabel('HIGH', locale)} /><ConditionGroup conditions={otherConditions} indexOffset={criticalConditions.length + highConditions.length} labels={labels} locale={locale} title={t('conditions')} /></HypothesisActiveSection>}

      {selectedSection === 'calculations' && (
        <HypothesisActiveSection code="CALC-04" description={calc('description')} title={calc('title')}>
          <GlassPanel glow className="data-grid p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div><div className="section-kicker">ORDER-OF-MAGNITUDE V1</div><p className="mt-3 max-w-3xl text-sm leading-6 text-[#91adaf]">{calc('description')}</p></div><form action={runCalculationAction.bind(null, locale, hypothesis.id, undefined, undefined)}><PendingActionButton idleLabel={calc('run')} pendingLabel={cockpitT('pending')} /></form></div></GlassPanel>
          {latestParameterRun && <div className="mt-5"><SectionHeader code="LATEST" title={calc('latestResult')} detail={getCalculationGapLabelFromRun(latestParameterRun.resultJson, locale)} /><div className="mt-4"><CalculationCard calculation={latestParameterRun} labels={calculationLabels} locale={locale} subject={hypothesis.originalTitle} /></div></div>}
          <div className="mt-5"><ParameterPlayground action={runParameterCalculationAction.bind(null, locale, hypothesis.id, undefined, undefined)} defaultScale={analysis.scale} labels={calculationLabels.playground} locale={locale} /></div>
          <div className="mt-5 grid gap-3 border-t border-cyan-100/[0.07] pt-5 md:grid-cols-2 xl:grid-cols-3">{conditions.map(condition => <form action={runCalculationAction.bind(null, locale, hypothesis.id, condition.id, undefined)} className="flex items-center justify-between gap-4 rounded-xl border border-cyan-100/[0.07] bg-black/25 p-4" key={condition.id}><span className="text-xs leading-5 text-cyan-50/75">{condition.title}</span><PendingActionButton className="rounded-lg border border-cyan-100/[0.1] bg-black/30 px-3 py-2 font-mono text-[9px] tracking-[.09em] text-cyan-100/55 uppercase" idleLabel={calc('runForCondition')} pendingLabel={cockpitT('pending')} /></form>)}</div>
          {calculationHistory.length ? <div className="mt-6 grid gap-4 xl:grid-cols-2">{calculationHistory.map(calculation => <CalculationCard calculation={calculation} labels={calculationLabels} locale={locale} subject={calculation.condition ? localizeMockValue(calculation.condition, locale).title : hypothesis.originalTitle} key={calculation.id} />)}</div> : !latestParameterRun && <TaskEmptyState openTask={cockpitT('mission.openTask')} task={missionTaskByType.get('RUN_CALCULATION')} text={calc('empty')} />}
        </HypothesisActiveSection>
      )}

      {selectedSection === 'sources' && <HypothesisActiveSection code="SRC-05" description={sourceT('description')} title={sourceT('title')}><div className="mb-5 flex justify-end"><form action={discoverSourcesAction.bind(null, locale, hypothesis.id, undefined)}><PendingActionButton idleLabel={sourceT('discover')} pendingLabel={cockpitT('pending')} /></form></div>{sources.length ? <div className="grid gap-4 md:grid-cols-2">{sources.map(source => <SourceCandidateCard source={source} summary={source.summary} locale={locale} labels={{candidate: sourceT('candidate'), openSearch: sourceT('openSearch')}} key={source.id} />)}</div> : <TaskEmptyState openTask={cockpitT('mission.openTask')} task={missionTaskByType.get('DISCOVER_SOURCES')} text={sourceT('empty')} />}</HypothesisActiveSection>}

      {selectedSection === 'experiments' && (
        <HypothesisActiveSection code="EXP-06" description={cockpitT('experimentsDescription')} title={e('designer')}>
          <GlassPanel glow className="data-grid mb-5 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <div className="section-kicker">{e('title')}</div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#91adaf]">{e('designerDescription')}</p>
              </div>
              <form action={generateExperimentAction.bind(null, locale, hypothesis.id, primaryBlocker?.id, primarySession?.id)}>
                <PendingActionButton idleLabel={e('generate')} pendingLabel={cockpitT('pending')} />
              </form>
            </div>
          </GlassPanel>
          {experiments.length ? (
            <div className="grid gap-4">
              {experiments.map((experiment, index) => <ExperimentPlanCard experiment={experiment} index={index} labels={experimentPlanLabels} locale={locale} key={experiment.id} />)}
            </div>
          ) : (
            <TaskEmptyState openTask={cockpitT('mission.openTask')} task={missionTaskByType.get('DESIGN_EXPERIMENT')} text={cockpitT('emptyExperiments')} />
          )}
        </HypothesisActiveSection>
      )}

      {selectedSection === 'breakthroughs' && <HypothesisActiveSection code="BRK-07" description={cockpitT('activeBreakthroughsDescription')} title={cockpitT('activeBreakthroughs')}>{visualLabBreakthroughs.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visualLabBreakthroughs.map(session => <BreakthroughSessionCard href={session.href} key={session.id} open={cockpitT('open')} progress={session.progressScore} title={session.title} />)}</div> : <TaskEmptyState openTask={cockpitT('mission.openTask')} task={missionTaskByType.get('START_BREAKTHROUGH')} text={cockpitT('emptyBreakthroughs')} />}</HypothesisActiveSection>}

      {selectedSection === 'lab-log' && <HypothesisActiveSection code="LOG-08" description={cockpitT('labLogDescription')} title={labT('title')}><LabLogTimeline items={labLogItems} locale={locale} labels={labLogLabels} /></HypothesisActiveSection>}

      {selectedSection === 'versions' && <HypothesisActiveSection code="HIST-09" description={cockpitT('versionsDescription')} title={cockpitT('versions')}><div className="grid gap-4 md:grid-cols-3"><SystemCounter title={t('tabs.simulations')} value={hypothesis.simulationRuns.length} locale={locale} /><SystemCounter title={t('tabs.sources')} value={sources.length} locale={locale} /><SystemCounter title={t('tabs.versions')} value={hypothesis.versions.length} locale={locale} /></div>{hypothesis.versions.length > 1 ? <div className="mt-5 space-y-3">{hypothesis.versions.slice().sort((a, b) => b.versionNumber - a.versionNumber).map(version => <GlassPanel className="p-4" key={version.id}><div className="flex items-center justify-between gap-3"><span className="mono-label">V{version.versionNumber}</span><span className="text-[10px] text-cyan-100/35">{formatDate(version.createdAt, locale)}</span></div><p className="mt-2 text-xs text-cyan-50/65">{version.changeSummary || version.title}</p></GlassPanel>)}</div> : <EmptyState text={cockpitT('emptyVersions')} />}</HypothesisActiveSection>}
    </HypothesisCockpitShell>
  );
}

type WorkspaceTranslator = (key: string) => string;

function toMissionTaskView({
  task,
  hypothesisId,
  labels,
  locale,
  sectionHref,
}: {
  conditionId?: string | null;
  hypothesisId: string;
  labels: {openTask: string; pending: string};
  locale: string;
  sectionHref: (section: HypothesisSection) => string;
  task: ResearchMissionTask;
}): ResearchMissionControlTask {
  const targetSection = sectionIds.includes(task.targetSection as HypothesisSection) ? task.targetSection as HypothesisSection : 'overview';
  const href = sectionHref(targetSection);
  const action = (() => {
    if (task.type === 'RUN_CALCULATION') {
      return <form action={runCalculationAction.bind(null, locale, hypothesisId, task.conditionId ?? undefined, task.breakthroughSessionId ?? undefined)}><PendingActionButton idleLabel={task.actionLabel} pendingLabel={labels.pending} /></form>;
    }
    if (task.type === 'DISCOVER_SOURCES') {
      return <form action={discoverSourcesAction.bind(null, locale, hypothesisId, task.conditionId ?? undefined)}><PendingActionButton idleLabel={task.actionLabel} pendingLabel={labels.pending} /></form>;
    }
    if ((task.type === 'BUILD_ENGINEERING_MODEL' || task.type === 'UPDATE_MODEL')) {
      return <form action={regenerateEngineeringModelAction.bind(null, locale, hypothesisId)}><PendingActionButton idleLabel={task.actionLabel} pendingLabel={labels.pending} /></form>;
    }
    if (task.type === 'START_BREAKTHROUGH' && task.conditionId) {
      return <form action={startBreakthroughAction.bind(null, locale, task.conditionId)}><PendingActionButton idleLabel={task.actionLabel} pendingLabel={labels.pending} /></form>;
    }
    if (task.type === 'DESIGN_EXPERIMENT') {
      return <form action={generateExperimentAction.bind(null, locale, hypothesisId, task.conditionId ?? undefined, task.breakthroughSessionId ?? undefined)}><PendingActionButton idleLabel={task.actionLabel} pendingLabel={labels.pending} /></form>;
    }
    return <GlowButton href={href} variant="secondary">{task.actionLabel || labels.openTask}</GlowButton>;
  })();
  return {
    id: task.id,
    action,
    actionLabel: task.actionLabel,
    description: task.description,
    href,
    priority: task.priority,
    status: task.status,
    targetSection: task.targetSection,
    title: task.title,
    type: task.type,
  };
}

type NextActionInput = {
  calculationCount: number;
  criticalCondition?: {id: string; title: string};
  experimentCount: number;
  hasPersistedEngineeringModel: boolean;
  hypothesisId: string;
  locale: string;
  primarySessionId?: string;
  sectionHref: (section: HypothesisSection) => string;
  sourceCount: number;
  cockpitT: WorkspaceTranslator;
};

function chooseNextAction(input: NextActionInput): {title: string; reason: string; action: ReactNode} {
  const pending = input.cockpitT('pending');
  if (!input.hasPersistedEngineeringModel) return {
    title: input.cockpitT('regenerateModel'),
    reason: input.cockpitT('actionReasons.regenerate'),
    action: <form action={regenerateEngineeringModelAction.bind(null, input.locale, input.hypothesisId)}><PendingActionButton idleLabel={input.cockpitT('regenerateModel')} pendingLabel={pending} /></form>,
  };
  if (input.calculationCount === 0) return {
    title: input.cockpitT('runCalculation'),
    reason: input.cockpitT('actionReasons.calculate'),
    action: <form action={runCalculationAction.bind(null, input.locale, input.hypothesisId, undefined, undefined)}><PendingActionButton idleLabel={input.cockpitT('runCalculation')} pendingLabel={pending} /></form>,
  };
  if (input.sourceCount === 0) return {
    title: input.cockpitT('discoverSources'),
    reason: input.cockpitT('actionReasons.sources'),
    action: <form action={discoverSourcesAction.bind(null, input.locale, input.hypothesisId, undefined)}><PendingActionButton idleLabel={input.cockpitT('discoverSources')} pendingLabel={pending} /></form>,
  };
  if (input.criticalCondition) return {
    title: input.cockpitT('startBreakthrough'),
    reason: input.cockpitT('actionReasons.breakthrough'),
    action: input.primarySessionId ? <GlowButton href={`/${input.locale}/breakthroughs/${input.primarySessionId}`}>{input.cockpitT('open')}</GlowButton> : <form action={startBreakthroughAction.bind(null, input.locale, input.criticalCondition.id)}><PendingActionButton idleLabel={input.cockpitT('startBreakthrough')} pendingLabel={pending} /></form>,
  };
  if (input.experimentCount === 0) return {
    title: input.cockpitT('engineering'),
    reason: input.cockpitT('actionReasons.engineering'),
    action: <GlowButton href={input.sectionHref('engineering')}>{input.cockpitT('open')}</GlowButton>,
  };
  return {
    title: input.cockpitT('inspectLabLog'),
    reason: input.cockpitT('actionReasons.labLog'),
    action: <GlowButton href={input.sectionHref('lab-log')}>{input.cockpitT('open')}</GlowButton>,
  };
}

function HealthPanel({labels, latestActivity, strongestBlocker, weakestProgress}: {labels: {health: string; strongestBlocker: string; weakestProgress: string; latestActivity: string; noData: string}; latestActivity: string; strongestBlocker?: string; weakestProgress: string}) {
  return <GlassPanel className="p-5"><div className="section-kicker">{labels.health}</div><div className="mt-4 grid gap-3"><MiniData label={labels.strongestBlocker} value={strongestBlocker || labels.noData} /><MiniData label={labels.weakestProgress} value={weakestProgress} /><MiniData label={labels.latestActivity} value={latestActivity} /></div></GlassPanel>;
}

function MiniData({label, value}: {label: string; value: string}) {
  return <div className="rounded-xl border border-cyan-100/[0.07] bg-black/25 p-3"><div className="font-mono text-[8px] tracking-[.08em] text-cyan-100/35 uppercase">{label}</div><p className="mt-1 text-xs leading-5 text-cyan-50/65">{value}</p></div>;
}

function QuickActions({hypothesisId, labels, labLogHref, locale, primaryBlockerId}: {hypothesisId: string; labels: {quickActions: string; runCalculation: string; discoverSources: string; startBreakthrough: string; regenerateModel: string; openLabLog: string; pending: string}; labLogHref: string; locale: string; primaryBlockerId?: string}) {
  return (
    <HypothesisQuickActions
      title={labels.quickActions}
      actions={<>
        <form action={runCalculationAction.bind(null, locale, hypothesisId, undefined, undefined)}><PendingActionButton idleLabel={labels.runCalculation} pendingLabel={labels.pending} /></form>
        <form action={discoverSourcesAction.bind(null, locale, hypothesisId, undefined)}><PendingActionButton idleLabel={labels.discoverSources} pendingLabel={labels.pending} /></form>
        {primaryBlockerId && <form action={startBreakthroughAction.bind(null, locale, primaryBlockerId)}><PendingActionButton idleLabel={labels.startBreakthrough} pendingLabel={labels.pending} /></form>}
        <form action={regenerateEngineeringModelAction.bind(null, locale, hypothesisId)}><PendingActionButton idleLabel={labels.regenerateModel} pendingLabel={labels.pending} /></form>
        <GlowButton href={labLogHref} variant="quiet">{labels.openLabLog}</GlowButton>
      </>}
    />
  );
}

function ConditionGroup({conditions, indexOffset, labels, locale, title}: {conditions: Array<any>; indexOffset: number; labels: Record<string, string>; locale: string; title: string}) {
  if (!conditions.length) return null;
  return <div className="mb-6 last:mb-0"><div className="mb-3 flex items-center gap-3"><div className="mono-label">{title}</div><div className="h-px flex-1 bg-cyan-100/[0.08]" /></div><div className="relative space-y-3 lg:ml-5 lg:border-l lg:border-cyan-200/15 lg:pl-8">{conditions.map((condition, index) => <div id={`condition-${condition.id}`} key={condition.id}><ConditionCard condition={condition} locale={locale} labels={labels} index={index + indexOffset} /></div>)}</div></div>;
}

function ExperimentCard({experiment, index, labels, locale}: {experiment: any; index: number; labels: {signal: string; falsification: string}; locale: string}) {
  return <GlassPanel className="p-5"><div className="flex items-start justify-between gap-4"><span className="mono-label">{locale === 'ru' ? '\u041f\u0440\u043e\u0442\u043e\u043a\u043e\u043b' : 'Protocol'} {String(index + 1).padStart(2, '0')}</span><div className="flex flex-wrap justify-end gap-2"><StatusBadge value={experiment.experimentType} locale={locale} label={getExperimentTypeLabel(experiment.experimentType, locale)} /><StatusBadge value={experiment.difficulty} locale={locale} label={getExperimentDifficultyLabel(experiment.difficulty, locale)} /><StatusBadge value={experiment.safetyLevel} locale={locale} label={getSafetyLevelLabel(experiment.safetyLevel, locale)} /></div></div><h3 className="mt-6 font-semibold text-cyan-50">{experiment.title}</h3><p className="mt-2 text-xs leading-5 text-[#769799]">{experiment.description}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><DataPoint label={labels.signal} value={experiment.expectedSignal} /><DataPoint label={labels.falsification} value={experiment.falsificationCriteria} /></div></GlassPanel>;
}

function BreakthroughSessionCard({href, open, progress, title}: {href?: string; open: string; progress: number; title: string}) {
  return <GlassPanel className="p-5"><div className="mono-label">ACTIVE BREAKTHROUGH</div><h3 className="mt-3 text-sm font-semibold text-cyan-50">{title}</h3><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-700 to-emerald-300" style={{width: `${Math.max(0, Math.min(100, progress))}%`}} /></div><div className="mt-4 flex items-center justify-between gap-3"><span className="font-mono text-[9px] text-cyan-100/35">{Math.round(progress)}%</span>{href && <GlowButton href={href} variant="quiet">{open}</GlowButton>}</div></GlassPanel>;
}

function EmptyState({text}: {text: string}) {
  return <p className="mt-5 rounded-xl border border-dashed border-cyan-100/[0.1] px-5 py-4 text-xs text-[#78999b]">{text}</p>;
}

function TaskEmptyState({openTask, task, text}: {openTask: string; task?: ResearchMissionControlTask; text: string}) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-cyan-100/[0.12] bg-black/20 px-5 py-4">
      <p className="text-xs leading-5 text-[#78999b]">{text}</p>
      {task && (
        <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-cyan-100/[0.08] bg-cyan-300/[0.025] p-3 sm:flex-row sm:items-center">
          <div>
            <div className="mono-label">{openTask}</div>
            <p className="mt-1 text-xs font-semibold text-cyan-50">{task.title}</p>
            <p className="mt-1 text-[10px] leading-4 text-cyan-50/45">{task.description}</p>
          </div>
          <div className="shrink-0">{task.action}</div>
        </div>
      )}
    </div>
  );
}

function formatDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {day: '2-digit', month: 'short', year: 'numeric'}).format(value);
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
