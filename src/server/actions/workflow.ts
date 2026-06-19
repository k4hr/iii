'use server';

import {revalidatePath} from 'next/cache';
import {requireCurrentUser} from '@/lib/auth/current-user';
import {syncResearchTasksForHypothesis} from '@/lib/workflow/research-mission-control';

export async function syncResearchMissionAction(locale: string, hypothesisId: string, _formData?: FormData) {
  const user = await requireCurrentUser();
  const routeLocale = locale === 'ru' ? 'ru' : 'en';
  await syncResearchTasksForHypothesis({
    hypothesisId,
    locale: routeLocale,
    ownerId: user.id,
    createEvent: true,
  });
  revalidatePath(`/${routeLocale}/hypotheses/${hypothesisId}`);
}
