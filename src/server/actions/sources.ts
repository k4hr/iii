'use server';

import {revalidatePath} from 'next/cache';
import {prisma} from '@/lib/db/prisma';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {discoverSourceCandidates} from '@/lib/sources/source-discovery';
import {requireCurrentUser} from '@/lib/auth/current-user';
import {normalizeSourceRelationship, normalizeSourceType} from '@/lib/prisma/normalize-enums';
import {toPrismaJsonObject} from '@/lib/prisma/safe-json';

export async function discoverSourcesAction(
  locale: string,
  hypothesisId: string,
  conditionId?: string,
  _formData?: FormData
) {
  const user = await requireCurrentUser();
  const hypothesis = await prisma.hypothesis.findFirst({where: {id: hypothesisId, ownerId: user.id}});
  if (!hypothesis) throw new Error('Hypothesis not found.');

  const condition = conditionId
    ? await prisma.hypothesisCondition.findFirst({where: {id: conditionId, hypothesisId}})
    : null;
  if (conditionId && !condition) throw new Error('The selected condition does not belong to this hypothesis.');

  const localizedCondition = condition ? localizeMockValue(condition, locale) : null;
  const candidates = await discoverSourceCandidates({
    locale,
    hypothesisTitle: hypothesis.originalTitle,
    hypothesisText: hypothesis.originalText,
    conditionTitle: localizedCondition?.title,
    conditionDescription: localizedCondition?.description,
    knownState: localizedCondition?.knownWhat,
    blockers: localizedCondition?.blockers,
  });

  const existing = await prisma.sourceReference.findMany({
    where: {hypothesisId, conditionId: condition?.id ?? null, url: {in: candidates.map(candidate => candidate.url)}},
    select: {url: true},
  });
  const existingUrls = new Set(existing.map(source => source.url).filter((url): url is string => Boolean(url)));
  const newCandidates = candidates.filter(candidate => !existingUrls.has(candidate.url));

  const breakthroughSession = condition
    ? await prisma.breakthroughSession.findFirst({
        where: {ownerId: user.id, hypothesisId, conditionId: condition.id},
        orderBy: {updatedAt: 'desc'},
      })
    : null;

  await prisma.$transaction(async tx => {
    await Promise.all(newCandidates.map(candidate => tx.sourceReference.create({
      data: {
        hypothesisId,
        ...(condition?.id ? {conditionId: condition.id} : {}),
        title: candidate.title || 'Source candidate',
        ...(candidate.url ? {url: candidate.url} : {}),
        sourceType: normalizeSourceType(candidate.sourceType),
        relationshipToHypothesis: normalizeSourceRelationship(candidate.relationshipToHypothesis),
        summary: candidate.summary || '',
      },
    })));

    if (breakthroughSession) {
      const ru = locale.toLowerCase() === 'ru';
      await tx.breakthroughEvent.create({
        data: {
          sessionId: breakthroughSession.id,
          type: 'SOURCE_ADDED',
          content: toPrismaJsonObject({
            message: ru ? 'Кандидаты источников добавлены для проверки.' : 'Source candidates were added for verification.',
            ...(condition?.id ? {conditionId: condition.id} : {}),
            discoveredCount: candidates.length,
            addedCount: newCandidates.length,
            relationships: newCandidates.map(candidate => candidate.relationshipToHypothesis),
          }),
        },
      });
    }
  });

  revalidatePath(`/${locale}/hypotheses/${hypothesisId}`);
  if (breakthroughSession) revalidatePath(`/${locale}/breakthroughs/${breakthroughSession.id}`);
}
