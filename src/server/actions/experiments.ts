'use server';

import {revalidatePath} from 'next/cache';
import {ExperimentDifficulty, ExperimentType, SafetyLevel} from '@prisma/client';
import {requireCurrentUser} from '@/lib/auth/current-user';
import {prisma} from '@/lib/db/prisma';
import {designExperiment} from '@/lib/experiments/experiment-designer';
import {routeLocaleToPrisma} from '@/lib/locale/locale';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {normalizeExperimentCostLevel, normalizeExperimentDifficulty, normalizeExperimentStatus, normalizeExperimentType, normalizeSafetyLevel} from '@/lib/prisma/normalize-enums';
import {toPrismaJsonArray, toPrismaJsonObject} from '@/lib/prisma/safe-json';
import {completeResearchTaskForHypothesis, syncResearchTasksForHypothesis} from '@/lib/workflow/research-mission-control';

export async function generateExperimentAction(
  locale: string,
  hypothesisId: string,
  conditionId?: string,
  breakthroughSessionId?: string,
  _formData?: FormData
) {
  const user = await requireCurrentUser();
  const routeLocale = locale === 'ru' ? 'ru' : 'en';
  const analysisLocale = routeLocaleToPrisma(routeLocale);
  const hypothesis = await prisma.hypothesis.findFirst({
    where: {id: hypothesisId, ownerId: user.id},
    include: {
      analyses: {orderBy: {createdAt: 'desc'}, take: 1, include: {translations: true}},
      conditions: {orderBy: [{importance: 'asc'}, {createdAt: 'asc'}]},
      calculationRuns: {orderBy: {createdAt: 'desc'}},
      sources: {orderBy: {createdAt: 'desc'}},
      visualScenes: {orderBy: {createdAt: 'desc'}, take: 1},
      researchTasks: {orderBy: [{priority: 'desc'}, {updatedAt: 'desc'}]},
      breakthroughSessions: {where: {ownerId: user.id}, orderBy: {updatedAt: 'desc'}},
    },
  });
  const analysis = hypothesis?.analyses[0];
  if (!hypothesis || !analysis) throw new Error('Hypothesis not found in the current workspace.');

  const breakthroughSession = breakthroughSessionId
    ? hypothesis.breakthroughSessions.find(session => session.id === breakthroughSessionId)
    : undefined;
  if (breakthroughSessionId && !breakthroughSession) throw new Error('Breakthrough session not found in the current workspace.');

  const effectiveConditionId = conditionId || breakthroughSession?.conditionId;
  const condition = effectiveConditionId ? hypothesis.conditions.find(item => item.id === effectiveConditionId) : undefined;
  if (effectiveConditionId && !condition) throw new Error('Condition does not belong to this hypothesis.');

  const translation = analysis.translations.find(item => item.locale === analysisLocale)
    ?? analysis.translations.find(item => item.locale === hypothesis.analysisLocale)
    ?? analysis.translations[0];
  const localizedConditions = hypothesis.conditions.map(item => localizeMockValue(item, routeLocale));
  const localizedSources = hypothesis.sources.map(item => localizeMockValue(item, routeLocale));
  const plan = await designExperiment({
    locale: routeLocale,
    hypothesis: {id: hypothesis.id, title: hypothesis.originalTitle, text: hypothesis.originalText},
    analysis: {
      summary: translation?.summary,
      formalizedClaim: translation?.formalizedClaim,
      scale: analysis.scale,
      realityGap: analysis.realityGap,
      researchProgress: analysis.researchProgress,
      functionalityProgress: analysis.functionalityProgress,
      testabilityProgress: analysis.testabilityProgress,
    },
    conditions: localizedConditions.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      importance: item.importance,
      status: item.status,
      testMethod: item.testMethod,
    })),
    calculations: hypothesis.calculationRuns.map(item => ({
      id: item.id,
      title: item.title,
      conditionId: item.conditionId,
      resultJson: item.resultJson,
      explanation: item.explanation,
    })),
    sources: localizedSources.map(item => ({
      id: item.id,
      title: item.title,
      conditionId: item.conditionId,
      summary: item.summary,
    })),
    engineeringModelJson: hypothesis.visualScenes[0]?.engineeringModelJson,
    researchTasks: hypothesis.researchTasks.map(item => ({
      type: item.type,
      title: item.title,
      description: item.description,
      targetSection: item.targetSection,
    })),
    breakthroughSessions: hypothesis.breakthroughSessions.map(item => ({
      id: item.id,
      conditionId: item.conditionId,
      title: localizeMockValue(item, routeLocale).title,
      problemStatement: localizeMockValue(item, routeLocale).problemStatement,
    })),
    conditionId: condition?.id,
    breakthroughSessionId: breakthroughSession?.id,
  });

  await prisma.$transaction(async tx => {
    const experiment = await tx.experimentProposal.create({
      data: {
        hypothesisId: hypothesis.id,
        ...(condition?.id ? {conditionId: condition.id} : {}),
        ...(breakthroughSession?.id ? {breakthroughSessionId: breakthroughSession.id} : {}),
        title: plan.title,
        description: plan.description,
        objective: plan.objective,
        hypothesisBeingTested: plan.hypothesisBeingTested,
        setupJson: toPrismaJsonArray(plan.setup),
        variablesJson: toPrismaJsonObject({
          independent: plan.independentVariables,
          dependent: plan.dependentVariables,
          control: plan.controlVariables,
        }),
        measurementsJson: toPrismaJsonObject({
          method: plan.measurementMethod,
          dataToCollect: plan.dataToCollect,
        }),
        equipmentJson: toPrismaJsonArray(plan.equipment),
        procedureJson: toPrismaJsonArray(plan.procedure),
        expectedResultsJson: toPrismaJsonObject({
          expected: plan.expectedResult,
          failure: plan.failureResult,
          nextStepAfterExperiment: plan.nextStepAfterExperiment,
          minimumViableTest: plan.minimumViableTest,
        }),
        successCriteriaJson: toPrismaJsonArray(plan.successCriteria),
        risksJson: toPrismaJsonArray(plan.risks),
        costLevel: normalizeExperimentCostLevel(plan.costLevel),
        difficultyLevel: normalizeExperimentDifficulty(plan.difficultyLevel),
        experimentType: normalizeExperimentType(plan.experimentType || ExperimentType.SMALL_LAB_TEST),
        difficulty: normalizeExperimentDifficulty(plan.difficultyLevel || ExperimentDifficulty.MEDIUM),
        safetyLevel: normalizeSafetyLevel(plan.safetyLevel || SafetyLevel.CAUTION),
        status: normalizeExperimentStatus(plan.status),
        requiredEquipmentJson: toPrismaJsonArray(plan.equipment),
        expectedSignal: plan.expectedResult,
        falsificationCriteria: plan.failureResult,
      },
    });

    if (breakthroughSession) {
      await tx.breakthroughEvent.create({
        data: {
          sessionId: breakthroughSession.id,
          type: 'AI_REASONING_STEP',
          content: toPrismaJsonObject({
            eventKey: 'EXPERIMENT_GENERATED',
            message: routeLocale === 'ru' ? 'Экспериментальный протокол сгенерирован.' : 'Experiment protocol generated.',
            hypothesisId: hypothesis.id,
            experimentId: experiment.id,
            conditionId: condition?.id,
            title: experiment.title,
          }),
        },
      });
    }

    return experiment;
  });

  await completeResearchTaskForHypothesis({hypothesisId: hypothesis.id, ownerId: user.id, type: 'DESIGN_EXPERIMENT'});
  await syncResearchTasksForHypothesis({hypothesisId: hypothesis.id, ownerId: user.id, locale: routeLocale});
  revalidatePath(`/${routeLocale}/hypotheses/${hypothesis.id}`);
  if (breakthroughSession) revalidatePath(`/${routeLocale}/breakthroughs/${breakthroughSession.id}`);
}
