'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {Scale} from '@prisma/client';
import {prisma} from '@/lib/db/prisma';
import {createHypothesisRecord} from '@/lib/hypotheses/create-hypothesis-record';
import {getOpenAIClient} from '@/lib/ai/openai-client';
import {generateEngineeringModel} from '@/lib/engineering/generate-engineering-model';
import {getConditionImportanceLabel} from '@/lib/locale/enum-labels';
import {routeLocaleToPrisma} from '@/lib/locale/locale';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {toPrismaJson, toPrismaJsonObject} from '@/lib/prisma/safe-json';
import {requireCurrentUser} from '@/lib/auth/current-user';

export async function createProjectAction(locale: string, formData: FormData) {
  const user = await requireCurrentUser();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!title) return;
  await prisma.project.create({data: {ownerId: user.id, title, ...(description ? {description} : {})}});
  redirect(`/${locale}/projects`);
}

export async function createHypothesisAction(locale: string, formData: FormData) {
  const user = await requireCurrentUser();
  const title = String(formData.get('title') || '').trim();
  const rawText = String(formData.get('rawText') || '').trim();
  const domain = String(formData.get('domain') || '').trim();
  const projectId = String(formData.get('projectId') || '').trim();
  if (!title || !rawText) return;

  const project = projectId
    ? await prisma.project.findFirst({where: {id: projectId, ownerId: user.id}, select: {id: true}})
    : null;
  if (projectId && !project) throw new Error('Project not found in the current workspace.');

  getOpenAIClient();
  const hypothesis = await createHypothesisRecord(prisma, {
    ownerId: user.id,
    ...(project?.id ? {projectId: project.id} : {}),
    title,
    rawText,
    ...(domain ? {domain} : {}),
    locale,
  });

  redirect(`/${locale}/hypotheses/${hypothesis.hypothesisId}`);
}

export async function startBreakthroughAction(locale: string, conditionId: string) {
  const user = await requireCurrentUser();
  const condition = await prisma.hypothesisCondition.findFirst({
    include: {hypothesis: true},
    where: {id: conditionId, hypothesis: {ownerId: user.id}},
  });
  if (!condition) return;

  const localized = localizeMockValue(condition, locale);
  const session = await prisma.breakthroughSession.create({
    data: {
      ownerId: user.id,
      ...(condition.hypothesis.projectId ? {projectId: condition.hypothesis.projectId} : {}),
      hypothesisId: condition.hypothesisId,
      conditionId: condition.id,
      title: localized.title,
      problemStatement: localized.description,
      whyItMatters: locale === 'ru'
        ? `Это условие имеет уровень «${getConditionImportanceLabel(condition.importance, locale)}» и необходимо для работоспособности гипотезы.`
        : `This condition is marked ${getConditionImportanceLabel(condition.importance, locale)} and is required for the hypothesis to work.`,
      ifSolvedImpact: toPrismaJsonObject(localizeMockValue(condition.ifSolvedImpactJson, locale)),
      knownState: toPrismaJsonObject(locale === 'ru' ? {известно: localized.knownWhat} : {known: localized.knownWhat}),
      missingPieces: toPrismaJsonObject(locale === 'ru'
        ? {неизвестно: localized.unknownWhat, необходимые_данные: localized.requiredEvidence}
        : {unknown: localized.unknownWhat, requiredEvidence: localized.requiredEvidence}),
      blockers: toPrismaJson(localizeMockValue(condition.blockers, locale), []),
      conflicts: toPrismaJson(localizeMockValue(condition.conflicts, locale), []),
      possiblePaths: toPrismaJson(localizeMockValue(condition.possibleWorkarounds, locale), []),
      ...(localized.testMethod ? {currentBestPath: localized.testMethod} : {}),
      progressScore: Number.isFinite(condition.completionScore) ? condition.completionScore : 0,
      events: {
        create: {
          type: 'STATUS_CHANGED',
          content: toPrismaJsonObject({message: locale === 'ru' ? 'Сессия поиска прорыва начата.' : 'Breakthrough session started.'}),
        },
      },
    },
  });
  redirect(`/${locale}/breakthroughs/${session.id}`);
}

export async function regenerateEngineeringModelAction(locale: string, hypothesisId: string) {
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
      experiments: {orderBy: {createdAt: 'desc'}},
      breakthroughSessions: {where: {ownerId: user.id}, orderBy: {updatedAt: 'desc'}},
      visualScenes: {take: 1, orderBy: {createdAt: 'desc'}},
    },
  });
  const analysis = hypothesis?.analyses[0];
  if (!hypothesis || !analysis) throw new Error('Hypothesis not found in the current workspace.');

  const translation = analysis.translations.find(item => item.locale === analysisLocale)
    ?? analysis.translations.find(item => item.locale === hypothesis.analysisLocale)
    ?? analysis.translations[0];
  const conditions = hypothesis.conditions.map(condition => localizeMockValue(condition, routeLocale));
  const sources = hypothesis.sources.map(source => localizeMockValue(source, routeLocale));
  const experiments = hypothesis.experiments.map(experiment => localizeMockValue(experiment, routeLocale));
  const breakthroughSessions = hypothesis.breakthroughSessions.map(session => localizeMockValue(session, routeLocale));

  const model = await generateEngineeringModel({
    locale: routeLocale,
    hypothesis: {id: hypothesis.id, title: hypothesis.originalTitle, text: hypothesis.originalText},
    analysis: {
      summary: translation?.summary,
      formalizedClaim: translation?.formalizedClaim,
      knownScience: translation?.knownScience,
      physicalConstraints: translation?.physicalConstraints,
      engineeringConstraints: translation?.engineeringConstraints,
      contradictions: translation?.contradictions,
      unknowns: translation?.unknowns,
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
      conditionId: experiment.conditionId,
      title: experiment.title,
    })),
    breakthroughSessions: breakthroughSessions.map(session => ({
      id: session.id,
      conditionId: session.conditionId,
      title: session.title,
      progressScore: session.progressScore,
    })),
  });

  const latestScene = hypothesis.visualScenes[0];
  const latestSession = hypothesis.breakthroughSessions[0];
  await prisma.$transaction(async tx => {
    const scene = latestScene
      ? await tx.visualScene.update({
          where: {id: latestScene.id},
          data: {engineeringModelJson: toPrismaJson(model)},
          select: {id: true},
        })
      : await tx.visualScene.create({
          data: {
            hypothesisId: hypothesis.id,
            analysisId: analysis.id,
            sceneType: 'generic_model',
            scale: analysis.scale || Scale.UNKNOWN,
            objectsJson: [],
            variablesJson: [],
            constraintsJson: [],
            measurementsJson: [],
            engineeringModelJson: toPrismaJson(model),
          },
          select: {id: true},
        });

    if (latestSession) {
      await tx.breakthroughEvent.create({
        data: {
          sessionId: latestSession.id,
          type: 'AI_REASONING_STEP',
          content: toPrismaJsonObject({
            eventKey: 'ENGINEERING_MODEL_REGENERATED',
            message: routeLocale === 'ru' ? 'Инженерная модель пересобрана.' : 'Engineering model regenerated.',
            hypothesisId: hypothesis.id,
            visualSceneId: scene.id,
            physicalModules: model.physicalModules.length,
            researchOverlays: model.researchOverlays.length,
          }),
        },
      });
    }
  });

  revalidatePath(`/${routeLocale}/hypotheses/${hypothesis.id}`);
  if (latestSession) revalidatePath(`/${routeLocale}/breakthroughs/${latestSession.id}`);
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
