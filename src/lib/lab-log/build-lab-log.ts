import 'server-only';

import type {Prisma} from '@prisma/client';
import enMessages from '@/messages/en.json';
import ruMessages from '@/messages/ru.json';
import {prisma} from '@/lib/db/prisma';
import {getEnumLabel, getIdeaStatusLabel, getSourceRelationshipLabel} from '@/lib/locale/enum-labels';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {getLocalizedSourceSummary} from '@/lib/sources/source-discovery';
import {requireCurrentUser} from '@/lib/auth/current-user';

export type LabLogSeverity = 'info' | 'success' | 'warning' | 'critical';
export type LabLogSourceType = 'hypothesis' | 'condition' | 'breakthrough' | 'idea' | 'calculation' | 'source' | 'experiment' | 'simulation' | 'system';

export type LabLogItem = {
  id: string;
  timestamp: Date;
  type: string;
  title: string;
  description: string;
  severity: LabLogSeverity;
  sourceType: LabLogSourceType;
  href?: string;
  metadata?: Record<string, unknown>;
};

export type BuildLabLogInput = {
  locale: 'en' | 'ru';
  hypothesisId?: string;
  breakthroughSessionId?: string;
  projectId?: string;
};

type LabLogLabels = typeof enMessages.labLog | typeof ruMessages.labLog;

export async function buildLabLog(input: BuildLabLogInput): Promise<LabLogItem[]> {
  const user = await requireCurrentUser();
  const locale = input.locale === 'ru' ? 'ru' : 'en';
  const labels = locale === 'ru' ? ruMessages.labLog : enMessages.labLog;
  const sessionContext = input.breakthroughSessionId
    ? await prisma.breakthroughSession.findFirst({
        where: {id: input.breakthroughSessionId, ownerId: user.id},
        select: {id: true, hypothesisId: true, conditionId: true, projectId: true},
      })
    : null;

  const directHypothesis = input.hypothesisId
    ? await prisma.hypothesis.findFirst({where: {id: input.hypothesisId, ownerId: user.id}, select: {id: true}})
    : null;
  const project = input.projectId
    ? await prisma.project.findFirst({where: {id: input.projectId, ownerId: user.id}, select: {id: true}})
    : null;
  const projectHypotheses = project
    ? await prisma.hypothesis.findMany({where: {projectId: project.id, ownerId: user.id}, select: {id: true}})
    : [];
  const workspaceHypotheses = !input.hypothesisId && !input.breakthroughSessionId && !input.projectId
    ? await prisma.hypothesis.findMany({where: {ownerId: user.id}, orderBy: {updatedAt: 'desc'}, take: 20, select: {id: true}})
    : [];
  const hypothesisIds = Array.from(new Set([
    ...(directHypothesis ? [directHypothesis.id] : []),
    ...(sessionContext ? [sessionContext.hypothesisId] : []),
    ...projectHypotheses.map(hypothesis => hypothesis.id),
    ...workspaceHypotheses.map(hypothesis => hypothesis.id),
  ]));
  if (!hypothesisIds.length) return [];

  const breakthroughOnly = Boolean(sessionContext);
  const sessionWhere = sessionContext ? {id: sessionContext.id, ownerId: user.id} : {ownerId: user.id, hypothesisId: {in: hypothesisIds}};
  const conditionWhere = sessionContext ? {id: sessionContext.conditionId} : {hypothesisId: {in: hypothesisIds}};

  const [
    hypotheses,
    analyses,
    conditions,
    versions,
    calculations,
    sources,
    experiments,
    simulations,
    sessions,
  ] = await Promise.all([
    prisma.hypothesis.findMany({where: {id: {in: hypothesisIds}, ownerId: user.id}}),
    prisma.hypothesisAnalysis.findMany({where: {hypothesisId: {in: hypothesisIds}}, orderBy: {createdAt: 'desc'}}),
    prisma.hypothesisCondition.findMany({where: conditionWhere, orderBy: {createdAt: 'asc'}}),
    breakthroughOnly ? Promise.resolve([]) : prisma.hypothesisVersion.findMany({where: {hypothesisId: {in: hypothesisIds}}, orderBy: {createdAt: 'desc'}}),
    prisma.calculationRun.findMany({
      where: sessionContext ? {breakthroughSessionId: sessionContext.id} : {hypothesisId: {in: hypothesisIds}},
      orderBy: {createdAt: 'desc'},
    }),
    prisma.sourceReference.findMany({
      where: sessionContext ? {conditionId: sessionContext.conditionId} : {hypothesisId: {in: hypothesisIds}},
      orderBy: {createdAt: 'desc'},
    }),
    prisma.experimentProposal.findMany({
      where: sessionContext ? {conditionId: sessionContext.conditionId} : {hypothesisId: {in: hypothesisIds}},
      orderBy: {createdAt: 'desc'},
    }),
    breakthroughOnly ? Promise.resolve([]) : prisma.simulationRun.findMany({where: {hypothesisId: {in: hypothesisIds}}, orderBy: {createdAt: 'desc'}}),
    prisma.breakthroughSession.findMany({where: sessionWhere, orderBy: {createdAt: 'desc'}}),
  ]);

  const sessionIds = sessions.map(session => session.id);
  const [ideas, events] = sessionIds.length
    ? await Promise.all([
        prisma.breakthroughIdea.findMany({where: {sessionId: {in: sessionIds}}, include: {checks: true}, orderBy: {createdAt: 'desc'}}),
        prisma.breakthroughEvent.findMany({where: {sessionId: {in: sessionIds}}, orderBy: {createdAt: 'desc'}}),
      ])
    : [[], []];

  const items: LabLogItem[] = [];
  const conditionById = new Map(conditions.map(condition => [condition.id, localizeMockValue(condition, locale)]));
  const ideaChecks = new Set(ideas.flatMap(idea => idea.checks.map(() => idea.id)));
  const calculationIds = new Set(calculations.map(calculation => calculation.id));
  const hasEngineeringModelVersionUpdate = versions.some(version => version.changeSummary === 'ENGINEERING_MODEL_UPDATED');

  if (!breakthroughOnly) {
    for (const hypothesis of hypotheses) {
      items.push({
        id: `hypothesis-${hypothesis.id}`,
        timestamp: hypothesis.createdAt,
        type: 'HYPOTHESIS_CREATED',
        title: labels.hypothesisCreated,
        description: labels.hypothesisDescription,
        severity: 'info',
        sourceType: 'hypothesis',
        href: `/${locale}/hypotheses/${hypothesis.id}`,
        metadata: {[labels.metadata.status]: getEnumLabel(hypothesis.status, locale)},
      });
    }

    const latestAnalysisByHypothesis = new Map<string, typeof analyses[number]>();
    for (const analysis of analyses) if (!latestAnalysisByHypothesis.has(analysis.hypothesisId)) latestAnalysisByHypothesis.set(analysis.hypothesisId, analysis);
    for (const analysis of latestAnalysisByHypothesis.values()) {
      items.push({
        id: `analysis-${analysis.id}`,
        timestamp: analysis.createdAt,
        type: 'ANALYSIS_CREATED',
        title: labels.analysisCreated,
        description: labels.analysisDescription,
        severity: analysis.realityGap === 'EXTREME' ? 'warning' : 'success',
        sourceType: 'system',
        href: `/${locale}/hypotheses/${analysis.hypothesisId}`,
        metadata: {[labels.metadata.status]: getEnumLabel(analysis.overallStatus, locale), [labels.metadata.gap]: getEnumLabel(analysis.realityGap, locale)},
      });
    }

    const conditionsByHypothesis = groupBy(conditions, condition => condition.hypothesisId);
    for (const [hypothesisId, hypothesisConditions] of conditionsByHypothesis) {
      if (!hypothesisConditions.length) continue;
      items.push({
        id: `condition-tree-${hypothesisId}`,
        timestamp: hypothesisConditions[0].createdAt,
        type: 'CONDITION_TREE_CREATED',
        title: labels.conditionTreeCreated,
        description: template(labels.conditionTreeDescription, {count: hypothesisConditions.length}),
        severity: 'info',
        sourceType: 'condition',
        href: `/${locale}/hypotheses/${hypothesisId}`,
        metadata: {[labels.metadata.count]: hypothesisConditions.length},
      });
      const critical = hypothesisConditions.filter(condition => condition.importance === 'CRITICAL');
      if (critical.length) {
        items.push({
          id: `critical-blockers-${hypothesisId}`,
          timestamp: critical[critical.length - 1].createdAt,
          type: 'CRITICAL_BLOCKER_DETECTED',
          title: labels.criticalBlocker,
          description: template(labels.criticalBlockerDescription, {count: critical.length}),
          severity: 'critical',
          sourceType: 'condition',
          href: `/${locale}/hypotheses/${hypothesisId}`,
          metadata: {[labels.metadata.condition]: critical.map(condition => localizeMockValue(condition, locale).title)},
        });
      }
    }

    for (const version of versions.filter(version => version.versionNumber > 1)) {
      const isEngineeringModelUpdate = version.changeSummary === 'ENGINEERING_MODEL_UPDATED';
      items.push({
        id: `version-${version.id}`,
        timestamp: version.createdAt,
        type: isEngineeringModelUpdate ? 'ENGINEERING_MODEL_UPDATED' : 'HYPOTHESIS_VERSION_CREATED',
        title: isEngineeringModelUpdate ? labels.engineeringModelUpdated : labels.versionCreated,
        description: isEngineeringModelUpdate ? labels.engineeringModelUpdatedDescription : version.changeSummary || version.title,
        severity: 'info',
        sourceType: isEngineeringModelUpdate ? 'system' : 'hypothesis',
        href: `/${locale}/hypotheses/${version.hypothesisId}`,
        metadata: {[labels.metadata.version]: version.versionNumber},
      });
    }
  }

  for (const calculation of calculations) {
    const input = jsonRecord(calculation.inputJson);
    const result = jsonRecord(calculation.resultJson);
    const gapLevel = stringValue(result.gapLevel);
    const isParameterEstimate = stringValue(input.mode) === 'parameter_playground';
    const energyGap = jsonRecord(result.energyGap);
    const scaleGap = jsonRecord(result.scaleGap);
    const impact = jsonRecord(result.impact);
    items.push({
      id: `calculation-${calculation.id}`,
      timestamp: calculation.createdAt,
      type: isParameterEstimate ? 'PARAMETER_RECALCULATED' : 'CALCULATION_RUN',
      title: isParameterEstimate ? labels.modelParametersRecalculated : labels.calculationRun,
      description: isParameterEstimate ? labels.parameterCalculationDescription : calculation.explanation || labels.calculationDescription,
      severity: gapLevel === 'EXTREME' ? 'critical' : gapLevel === 'HIGH' ? 'warning' : 'success',
      sourceType: 'calculation',
      href: calculation.breakthroughSessionId ? `/${locale}/breakthroughs/${calculation.breakthroughSessionId}` : `/${locale}/hypotheses/${calculation.hypothesisId}`,
      metadata: isParameterEstimate
        ? {
            [labels.metadata.gap]: getEnumLabel(gapLevel, locale),
            [labels.metadata.energyGap]: numberValue(energyGap.orders),
            [labels.metadata.scaleGap]: numberValue(scaleGap.orders),
            [labels.metadata.testabilityImpact]: numberValue(impact.testabilityProgress),
          }
        : gapLevel ? {[labels.metadata.gap]: getEnumLabel(gapLevel, locale)} : undefined,
    });
  }

  for (const source of sources) {
    items.push({
      id: `source-${source.id}`,
      timestamp: source.createdAt,
      type: 'SOURCE_CANDIDATE_FOUND',
      title: labels.sourceCandidateFound,
      description: getLocalizedSourceSummary(source, locale) || labels.sourceCandidateDescription,
      severity: source.relationshipToHypothesis === 'CONTRADICTS' ? 'warning' : 'info',
      sourceType: 'source',
      href: sessionContext ? `/${locale}/breakthroughs/${sessionContext.id}` : `/${locale}/hypotheses/${source.hypothesisId}`,
      metadata: {[labels.metadata.relationship]: getSourceRelationshipLabel(source.relationshipToHypothesis, locale)},
    });
  }

  for (const experiment of experiments) {
    const localized = localizeMockValue(experiment, locale);
    items.push({
      id: `experiment-${experiment.id}`,
      timestamp: experiment.createdAt,
      type: 'EXPERIMENT_PROPOSED',
      title: labels.experimentProposed,
      description: localized.description || labels.experimentDescription,
      severity: experiment.safetyLevel === 'DANGEROUS' ? 'critical' : experiment.difficulty === 'EXTREME' ? 'warning' : 'success',
      sourceType: 'experiment',
      href: sessionContext ? `/${locale}/breakthroughs/${sessionContext.id}` : `/${locale}/hypotheses/${experiment.hypothesisId}`,
      metadata: {[labels.metadata.status]: getEnumLabel(experiment.experimentType, locale)},
    });
  }

  for (const simulation of simulations) {
    items.push({
      id: `simulation-${simulation.id}`,
      timestamp: simulation.createdAt,
      type: 'SIMULATION_CREATED',
      title: labels.simulationCreated,
      description: labels.simulationDescription,
      severity: 'info',
      sourceType: 'simulation',
      href: `/${locale}/hypotheses/${simulation.hypothesisId}`,
      metadata: {[labels.metadata.status]: getEnumLabel(simulation.status, locale)},
    });
  }

  for (const session of sessions) {
    const condition = conditionById.get(session.conditionId);
    items.push({
      id: `breakthrough-${session.id}`,
      timestamp: session.createdAt,
      type: 'BREAKTHROUGH_STARTED',
      title: labels.breakthroughStarted,
      description: labels.breakthroughDescription,
      severity: 'success',
      sourceType: 'breakthrough',
      href: `/${locale}/breakthroughs/${session.id}`,
      metadata: {[labels.metadata.condition]: condition?.title || session.title, [labels.metadata.status]: getEnumLabel(session.status, locale)},
    });
  }

  for (const idea of ideas) {
    const localized = localizeMockValue(idea, locale);
    items.push({
      id: `idea-${idea.id}`,
      timestamp: idea.createdAt,
      type: 'USER_IDEA_ADDED',
      title: labels.userIdeaAdded,
      description: localized.formalizedText || localized.rawText || labels.ideaDescription,
      severity: idea.status === 'CONTRADICTED' || idea.status === 'WEAK' ? 'warning' : idea.status === 'PROMISING' ? 'success' : 'info',
      sourceType: 'idea',
      href: `/${locale}/breakthroughs/${idea.sessionId}`,
      metadata: {[labels.metadata.status]: getIdeaStatusLabel(idea.status, locale)},
    });
    for (const check of idea.checks) {
      items.push({
        id: `idea-check-${check.id}`,
        timestamp: check.createdAt,
        type: 'IDEA_REVIEW_COMPLETED',
        title: labels.ideaReviewCompleted,
        description: labels.ideaReviewDescription,
        severity: 'success',
        sourceType: 'idea',
        href: `/${locale}/breakthroughs/${idea.sessionId}`,
        metadata: {[labels.metadata.check]: getEnumLabel(check.checkType, locale)},
      });
    }
  }

  for (const event of events) {
    const content = jsonRecord(localizeMockValue(event.content, locale) as Prisma.JsonValue);
    const calculationRunId = stringValue(content.calculationRunId);
    const ideaId = stringValue(content.ideaId);
    const message = stringValue(content.message);
    if (calculationRunId && calculationIds.has(calculationRunId)) continue;
    if (event.type === 'AI_REASONING_STEP' && ideaId && ideaChecks.has(ideaId)) continue;
    if (!breakthroughOnly && hasEngineeringModelVersionUpdate && event.type === 'AI_REASONING_STEP' && stringValue(content.eventKey) === 'ENGINEERING_MODEL_UPDATED') continue;
    if (event.type === 'STATUS_CHANGED' && /started|начат/i.test(message)) continue;
    const mapped = mapBreakthroughEvent(event.type, content, labels, locale);
    const linkedHypothesisId = stringValue(content.hypothesisId);
    items.push({
      id: `event-${event.id}`,
      timestamp: event.createdAt,
      type: event.type,
      title: mapped.title,
      description: message || mapped.description,
      severity: mapped.severity,
      sourceType: mapped.sourceType,
      href: linkedHypothesisId ? `/${locale}/hypotheses/${linkedHypothesisId}` : `/${locale}/breakthroughs/${event.sessionId}`,
      metadata: mapped.metadata,
    });
  }

  return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

function mapBreakthroughEvent(
  type: string,
  content: Record<string, Prisma.JsonValue>,
  labels: LabLogLabels,
  locale: 'en' | 'ru'
): Pick<LabLogItem, 'title' | 'description' | 'severity' | 'sourceType' | 'metadata'> {
  if (type === 'SOURCE_ADDED') return {title: labels.sourceDiscoveryRun, description: labels.sourceCandidateDescription, severity: 'info', sourceType: 'source', metadata: {[labels.metadata.count]: numberValue(content.addedCount)}};
  if (type === 'SUB_HYPOTHESIS_CREATED') return {title: labels.subHypothesisCreated, description: stringValue(content.description) || labels.hypothesisDescription, severity: 'success', sourceType: 'hypothesis'};
  if (type === 'NEW_PATH_FOUND') return {title: labels.workaroundFound, description: stringValue(content.description) || stringValue(content.path), severity: 'success', sourceType: 'breakthrough'};
  if (type === 'PARAMETER_CHANGE') return {
    title: labels.modelParametersRecalculated,
    description: stringValue(content.message) || labels.parameterCalculationDescription,
    severity: 'info',
    sourceType: 'calculation',
    metadata: {
      [labels.metadata.energyGap]: numberValue(content.energyGap),
      [labels.metadata.scaleGap]: numberValue(content.scaleGap),
      [labels.metadata.testabilityImpact]: numberValue(content.testabilityImpact),
    },
  };
  if (type === 'AI_REASONING_STEP' && stringValue(content.eventKey) === 'ENGINEERING_MODEL_REGENERATED') return {
    title: labels.engineeringModelRegenerated,
    description: stringValue(content.message) || labels.engineeringModelRegeneratedDescription,
    severity: 'success',
    sourceType: 'system',
    metadata: {
      [labels.metadata.count]: numberValue(content.physicalModules),
    },
  };
  if (type === 'AI_REASONING_STEP' && stringValue(content.eventKey) === 'ENGINEERING_MODEL_UPDATED') return {
    title: labels.engineeringModelUpdated,
    description: stringValue(content.message) || labels.engineeringModelUpdatedDescription,
    severity: 'success',
    sourceType: 'system',
    metadata: {
      [labels.metadata.count]: numberValue(content.physicalModules),
    },
  };
  if (type === 'STATUS_CHANGED') return {title: labels.statusChanged, description: stringValue(content.description), severity: 'info', sourceType: 'breakthrough', metadata: {[labels.metadata.status]: getEnumLabel(stringValue(content.status), locale)}};
  if (type === 'USER_NOTE') return {title: labels.userNote, description: stringValue(content.note), severity: 'info', sourceType: 'idea', metadata: stringValue(content.note) ? {[labels.metadata.note]: stringValue(content.note)} : undefined};
  if (type === 'AI_REASONING_STEP') return {title: labels.deeperBreakdown, description: stringValue(content.description) || labels.analysisDescription, severity: 'info', sourceType: 'system'};
  if (type === 'CALCULATION_RUN') return {title: labels.calculationRun, description: labels.calculationDescription, severity: 'success', sourceType: 'calculation'};
  return {title: getEnumLabel(type, locale), description: stringValue(content.description), severity: 'info', sourceType: 'system'};
}

function groupBy<T, K>(values: T[], key: (value: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const value of values) groups.set(key(value), [...(groups.get(key(value)) || []), value]);
  return groups;
}

function jsonRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

function stringValue(value: Prisma.JsonValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: Prisma.JsonValue | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function template(value: string, variables: Record<string, string | number>): string {
  return Object.entries(variables).reduce((result, [key, replacement]) => result.replace(`{${key}}`, String(replacement)), value);
}
