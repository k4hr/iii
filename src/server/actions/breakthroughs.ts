'use server';

import {revalidatePath} from 'next/cache';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db/prisma';
import {evaluateBreakthroughIdea} from '@/lib/ai/evaluate-breakthrough-idea';
import {getOpenAIClient} from '@/lib/ai/openai-client';
import {routeLocaleToPrisma} from '@/lib/locale/locale';
import {requireCurrentUser} from '@/lib/auth/current-user';

export async function addIdeaAction(locale: string, sessionId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const rawText = String(formData.get('rawText') || '').trim();
  if (!rawText) return;
  const session = await prisma.breakthroughSession.findFirst({where: {id: sessionId, ownerId: user.id}, select: {id: true}});
  if (!session) throw new Error('Breakthrough session not found in the current workspace.');
  getOpenAIClient();
  const analysisLocale = routeLocaleToPrisma(locale);
  const review = evaluateBreakthroughIdea(rawText, analysisLocale);
  const idea = await prisma.breakthroughIdea.create({
    data: {
      sessionId,
      authorType: 'USER',
      title: review.title,
      rawText,
      formalizedText: review.formalizedText,
      status: review.status,
      impactJson: review.impactJson as Prisma.InputJsonValue,
      reviewJson: review.reviewJson as Prisma.InputJsonValue,
      assumptionsJson: review.assumptionsJson as Prisma.InputJsonValue,
      newBlockersJson: review.newBlockersJson as Prisma.InputJsonValue,
      checks: {create: {checkType: 'ORDER_OF_MAGNITUDE_CALC', resultJson: {status: 'preliminary', message: analysisLocale === 'RU' ? 'Требуется проверка исходных параметров и расчётов.' : 'Input parameters and calculations require validation.'} as Prisma.InputJsonValue}}
    }
  });
  await prisma.breakthroughEvent.create({data: {sessionId, type: 'AI_REASONING_STEP', content: {message: analysisLocale === 'RU' ? 'Проверка идеи завершена.' : 'Idea review completed.', ideaId: idea.id} as Prisma.InputJsonValue}});
  revalidatePath(`/${locale}/breakthroughs/${sessionId}`);
}

export async function addUserNoteAction(locale: string, sessionId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const note = String(formData.get('note') || '').trim();
  if (!note) return;
  const session = await prisma.breakthroughSession.findFirst({where: {id: sessionId, ownerId: user.id}, select: {id: true}});
  if (!session) throw new Error('Breakthrough session not found in the current workspace.');
  await prisma.breakthroughEvent.create({data: {sessionId, type: 'USER_NOTE', content: {note} as Prisma.InputJsonValue}});
  revalidatePath(`/${locale}/breakthroughs/${sessionId}`);
}
