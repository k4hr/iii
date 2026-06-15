'use server';

import {Prisma, Scale} from '@prisma/client';
import {revalidatePath} from 'next/cache';
import {DesiredEffectLevel, runOrderOfMagnitudeCalculation, runParameterEstimate} from '@/lib/calculations/order-of-magnitude';
import {prisma} from '@/lib/db/prisma';
import {localizeMockValue} from '@/lib/locale/mock-copy';

export async function runCalculationAction(
  locale: string,
  hypothesisId: string,
  conditionId?: string,
  breakthroughSessionId?: string,
  _formData?: FormData
) {
  const hypothesis = await prisma.hypothesis.findUnique({
    where: {id: hypothesisId},
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
    scale: hypothesis.analyses[0]?.scale,
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
        conditionId: condition?.id,
        breakthroughSessionId: breakthroughSession?.id,
        title: calculation.title,
        calculationType: calculation.calculationType,
        inputJson: calculation.input as Prisma.InputJsonValue,
        resultJson: calculation.result as Prisma.InputJsonValue,
        explanation: calculation.explanation,
      },
    });

    if (breakthroughSession) {
      const ru = locale.toLowerCase() === 'ru';
      await tx.breakthroughEvent.create({
        data: {
          sessionId: breakthroughSession.id,
          type: 'CALCULATION_RUN',
          content: {
            message: ru ? 'Грубый расчёт завершён.' : 'Rough calculation completed.',
            calculationRunId: created.id,
            title: created.title,
            calculationType: created.calculationType,
            gapOrders: calculation.result.gapOrders,
            gapLevel: calculation.result.gapLevel,
          } as Prisma.InputJsonValue,
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
  const hypothesis = await prisma.hypothesis.findUnique({
    where: {id: hypothesisId},
    include: {analyses: {orderBy: {createdAt: 'desc'}, take: 1}},
  });
  if (!hypothesis) throw new Error('Hypothesis not found.');

  const condition = conditionId
    ? await prisma.hypothesisCondition.findFirst({where: {id: conditionId, hypothesisId}})
    : null;
  if (conditionId && !condition) throw new Error('The selected condition does not belong to this hypothesis.');

  const breakthroughSession = breakthroughSessionId
    ? await prisma.breakthroughSession.findFirst({
        where: {id: breakthroughSessionId, hypothesisId, ...(conditionId ? {conditionId} : {})},
      })
    : null;
  if (breakthroughSessionId && !breakthroughSession) {
    throw new Error('The selected breakthrough session does not match this hypothesis and condition.');
  }

  const localizedCondition = condition ? localizeMockValue(condition, locale) : null;
  const objectScaleValue = String(parameters.get('objectScale') || 'UNKNOWN');
  const desiredEffectValue = String(parameters.get('desiredEffect') || 'MEDIUM');
  const objectScale = Object.values(Scale).includes(objectScaleValue as Scale) ? objectScaleValue as Scale : Scale.UNKNOWN;
  const desiredEffect = isDesiredEffect(desiredEffectValue) ? desiredEffectValue : 'MEDIUM';
  const estimate = runParameterEstimate(locale, {
    objectScale,
    objectMassKg: formNumber(parameters, 'objectMassKg', 1),
    objectSizeM: formNumber(parameters, 'objectSizeM', 1),
    availableEnergyJ: formNumber(parameters, 'availableEnergyJ', 1e6),
    desiredEffect,
    observationTimeS: formNumber(parameters, 'observationTimeS', 60),
    measurementSensitivity: formNumber(parameters, 'measurementSensitivity', 1e-9),
    fieldIntensity: formNumber(parameters, 'fieldIntensity', 1),
    notes: String(parameters.get('notes') || ''),
  }, {
    locale,
    hypothesisTitle: hypothesis.originalTitle,
    hypothesisText: hypothesis.originalText,
    scale: hypothesis.analyses[0]?.scale,
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
        conditionId: condition?.id,
        breakthroughSessionId: breakthroughSession?.id,
        title: estimate.title,
        calculationType: estimate.calculationType,
        inputJson: estimate.input as Prisma.InputJsonValue,
        resultJson: estimate.result as Prisma.InputJsonValue,
        explanation: estimate.explanation,
      },
    });

    if (breakthroughSession) {
      const ru = locale.toLowerCase() === 'ru';
      await tx.breakthroughEvent.create({
        data: {
          sessionId: breakthroughSession.id,
          type: 'CALCULATION_RUN',
          content: {
            message: ru ? 'Параметрический сценарий рассчитан.' : 'Parameter scenario calculated.',
            calculationRunId: created.id,
            gapLevel: estimate.result.gapLevel,
            gapOrders: estimate.result.gapOrders,
            mainRemainingBlocker: estimate.result.mainRemainingBlocker,
            impact: estimate.result.impact,
          } as Prisma.InputJsonValue,
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
