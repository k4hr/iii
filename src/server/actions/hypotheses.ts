'use server';

import {redirect} from 'next/navigation';
import {prisma} from '@/lib/db/prisma';
import {createHypothesisRecord} from '@/lib/hypotheses/create-hypothesis-record';
import {getOpenAIClient} from '@/lib/ai/openai-client';
import {getConditionImportanceLabel} from '@/lib/locale/enum-labels';
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
