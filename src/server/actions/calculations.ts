'use server';

import {Scale} from '@prisma/client';
import {revalidatePath} from 'next/cache';
import {DesiredEffectLevel, runOrderOfMagnitudeCalculation, runParameterEstimate} from '@/lib/calculations/order-of-magnitude';
import {prisma} from '@/lib/db/prisma';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {requireCurrentUser} from '@/lib/auth/current-user';
import {normalizeScale} from '@/lib/prisma/normalize-enums';
import {toPrismaJsonObject} from '@/lib/prisma/safe-json';

export async function runCalculationAction(
  locale: string,
  hypothesisId: string,
  conditionId?: string,
  breakthroughSessionId?: string,
  _formData?: FormData
) {
  const user = await requireCurrentUser();
  const hypothesis = await prisma.hypothesis.findFirst({
    where: {id: hypothesisId, ownerId: user.id},
    include: {analyses: {orderBy: {createdAt: 'desc'}, take: 1}},
  });
  if (!hypothesis) throw new Error('Hypothesis not found.');

  const condition = conditionId
    ? await prisma.hypothesisCondition.findFirst({where: {id: conditionId, hypothesisId}})
    : null;
  if (conditionId && !condition) throw new Error('The selected condition does not belong to this hypothesis.');

  const breakthroughSession = breakthroughSessionId
    ? await prisma.breakthroughSession.findFirst({
        where: {
          id: breakthroughSessionId,
          ownerId: user.id,
          hypothesisId,
          ...(conditionId ? {conditionId} : {}),
        },
      })
    : null;
  if (breakthroughSessionId && !breakthroughSession) {
    throw new Error('The selected breakthrough session does not match this hypothesis and condition.');
  }

  const localizedCondition = condition ? localizeMockValue(condition, locale) : null;
  const calculation = runOrderOfMagnitudeCalculation({
    locale,
    hypothesisTitle: hypothesis.originalTitle,
    hypothesisText: hypothesis.originalText,
    scale: normalizeScale(hypothesis.analyses[0]?.scale, Scale.UNKNOWN),
    realityGap: hypothesis.analyses[0]?.realityGap,
    conditionTitle: localizedCondition?.title,
    conditionDescription: localizedCondition?.description,
    conditionStatus: condition?.status,
    conditionImportance: condition?.importance,
    completionScore: condition?.completionScore,
  });

  await prisma.$transaction(async tx => {
    const created = await tx.calculationRun.create({
      data: {
        hypothesisId,
        ...(condition?.id ? {conditionId: condition.id} : {}),
        ...(breakthroughSession?.id ? {breakthroughSessionId: breakthroughSession.id} : {}),
        title: calculation.title,
        calculationType: calculation.calculationType,
        inputJson: toPrismaJsonObject(calculation.input),
        resultJson: toPrismaJsonObject(calculation.result),
        explanation: calculation.explanation,
      },
    });

    if (breakthroughSession) {
      const ru = locale.toLowerCase() === 'ru';
      await tx.breakthroughEvent.create({
        data: {
          sessionId: breakthroughSession.id,
          type: 'CALCULATION_RUN',
          content: toPrismaJsonObject({
            message: ru ? 'Грубый расчёт завершён.' : 'Rough calculation completed.',
            calculationRunId: created.id,
            title: created.title,
            calculationType: created.calculationType,
            gapOrders: calculation.result.gapOrders,
            gapLevel: calculation.result.gapLevel,
          }),
        },
      });
    }

    return created;
  });

  revalidatePath(`/${locale}/hypotheses/${hypothesisId}`);
  if (breakthroughSession) revalidatePath(`/${locale}/breakthroughs/${breakthroughSession.id}`);
}

export async function runParameterCalculationAction(
  locale: string,
  hypothesisId: string,
  conditionId: string | undefined,
  breakthroughSessionId: string | undefined,
  parameters: FormData
) {
  const user = await requireCurrentUser();
  const hypothesis = await prisma.hypothesis.findFirst({
    where: {id: hypothesisId, ownerId: user.id},
    include: {analyses: {orderBy: {createdAt: 'desc'}, take: 1}},
  });
  if (!hypothesis) throw new Error('Hypothesis not found.');

  const condition = conditionId
    ? await prisma.hypothesisCondition.findFirst({where: {id: conditionId, hypothesisId}})
    : null;
  if (conditionId && !condition) throw new Error('The selected condition does not belong to this hypothesis.');

  const breakthroughSession = breakthroughSessionId
    ? await prisma.breakthroughSession.findFirst({
        where: {id: breakthroughSessionId, ownerId: user.id, hypothesisId, ...(conditionId ? {conditionId} : {})},
      })
    : null;
  if (breakthroughSessionId && !breakthroughSession) {
    throw new Error('The selected breakthrough session does not match this hypothesis and condition.');
  }

  const localizedCondition = condition ? localizeMockValue(condition, locale) : null;
  const objectScaleValue = String(parameters.get('objectScale') || 'UNKNOWN');
  const desiredEffectValue = String(parameters.get('desiredEffect') || 'MEDIUM');
  const objectScale = normalizeScale(objectScaleValue, Scale.UNKNOWN);
  const desiredEffect = isDesiredEffect(desiredEffectValue) ? desiredEffectValue : 'MEDIUM';
  const estimate = runParameterEstimate(locale, {
    objectScale,
    objectMassKg: formNumber(parameters, 'objectMassKg', 1),
    objectSizeM: formNumber(parameters, 'objectSizeM', 1),
    availableEnergyJ: formNumber(parameters, 'availableEnergyJ', 1e6),
    requiredEnergyJ: formNumber(parameters, 'requiredEnergyJ', 1e9),
    desiredEffect,
    observationTimeS: formNumber(parameters, 'observationTimeS', 60),
    measurementSensitivity: formNumber(parameters, 'measurementSensitivity', 1e-9),
    fieldIntensity: formNumber(parameters, 'fieldIntensity', 1),
    notes: String(parameters.get('notes') || ''),
  }, {
    locale,
    hypothesisTitle: hypothesis.originalTitle,
    hypothesisText: hypothesis.originalText,
    scale: normalizeScale(hypothesis.analyses[0]?.scale, Scale.UNKNOWN),
    realityGap: hypothesis.analyses[0]?.realityGap,
    conditionTitle: localizedCondition?.title,
    conditionDescription: localizedCondition?.description,
    conditionStatus: condition?.status,
    conditionImportance: condition?.importance,
    completionScore: condition?.completionScore,
  });

  await prisma.$transaction(async tx => {
    const created = await tx.calculationRun.create({
      data: {
        hypothesisId,
        ...(condition?.id ? {conditionId: condition.id} : {}),
        ...(breakthroughSession?.id ? {breakthroughSessionId: breakthroughSession.id} : {}),
        title: estimate.title,
        calculationType: estimate.calculationType,
        inputJson: toPrismaJsonObject(estimate.input),
        resultJson: toPrismaJsonObject(estimate.result),
        explanation: estimate.explanation,
      },
    });

    if (breakthroughSession) {
      const ru = locale.toLowerCase() === 'ru';
      await tx.breakthroughEvent.create({
        data: {
          sessionId: breakthroughSession.id,
          type: 'PARAMETER_CHANGE',
          content: toPrismaJsonObject({
            message: ru ? 'Параметры модели пересчитаны.' : 'Model parameters recalculated.',
            calculationRunId: created.id,
            hypothesisId,
            gapLevel: estimate.result.gapLevel,
            gapOrders: estimate.result.gapOrders,
            energyGap: estimate.result.energyGap.orders,
            scaleGap: estimate.result.scaleGap.orders,
            testabilityImpact: estimate.result.impact.testabilityProgress,
            mainRemainingBlocker: estimate.result.mainRemainingBlocker,
            suggestedNextExperiment: estimate.result.suggestedNextExperiment,
            impact: estimate.result.impact,
          }),
        },
      });
    }
  });

  revalidatePath(`/${locale}/hypotheses/${hypothesisId}`);
  if (breakthroughSession) revalidatePath(`/${locale}/breakthroughs/${breakthroughSession.id}`);
}

function formNumber(formData: FormData, key: string, fallback: number): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isDesiredEffect(value: string): value is DesiredEffectLevel {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'EXTREME';
}
