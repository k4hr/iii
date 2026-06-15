'use server';

import {redirect} from 'next/navigation';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db/prisma';
import {detectLanguage} from '@/lib/ai/detect-language';
import {createCanonicalHypothesis} from '@/lib/ai/create-canonical-hypothesis';
import {analyzeHypothesisMock} from '@/lib/ai/analyze-hypothesis';
import {getOpenAIClient} from '@/lib/ai/openai-client';
import {routeLocaleToPrisma} from '@/lib/locale/locale';
import {getConditionImportanceLabel} from '@/lib/locale/enum-labels';
import {localizeMockValue} from '@/lib/locale/mock-copy';
import {requireCurrentUser} from '@/lib/auth/current-user';

function jsonValueOrObject(value: Prisma.JsonValue | null | undefined): Prisma.InputJsonValue {
  if (value === null || value === undefined) return {};
  return value as Prisma.InputJsonValue;
}

export async function createProjectAction(locale: string, formData: FormData) {
  const user = await requireCurrentUser();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!title) return;
  await prisma.project.create({data: {ownerId: user.id, title, description}});
  redirect(`/${locale}/projects`);
}

export async function createHypothesisAction(locale: string, formData: FormData) {
  const user = await requireCurrentUser();
  const title = String(formData.get('title') || '').trim();
  const rawText = String(formData.get('rawText') || '').trim();
  const domain = String(formData.get('domain') || '').trim() || undefined;
  const projectId = String(formData.get('projectId') || '').trim() || undefined;
  if (!title || !rawText) return;

  const project = projectId
    ? await prisma.project.findFirst({where: {id: projectId, ownerId: user.id}, select: {id: true}})
    : null;
  if (projectId && !project) throw new Error('Project not found in the current workspace.');

  getOpenAIClient();

  const originalLocale = detectLanguage(`${title}\n${rawText}`);
  const analysisLocale = routeLocaleToPrisma(locale);
  const canonical = createCanonicalHypothesis({title, text: rawText, locale: originalLocale});
  const mock = analyzeHypothesisMock({title, text: rawText, analysisLocale});

  const hypothesis = await prisma.hypothesis.create({
    data: {
      ownerId: user.id,
      originalLocale,
      originalTitle: title,
      originalText: rawText,
      canonicalTitleEn: canonical.canonicalTitleEn,
      canonicalTextEn: canonical.canonicalTextEn,
      interfaceLocaleAtCreate: routeLocaleToPrisma(locale),
      analysisLocale,
      domain,
      projectId: project?.id,
      status: 'DONE',
      versions: {create: {versionNumber: 1, title, text: rawText, canonicalTextEn: canonical.canonicalTextEn, changeSummary: 'Initial version'}},
      analyses: {
        create: {
          canonicalJson: mock.canonicalJson,
          scale: mock.scale,
          verdictLevel: mock.verdictLevel,
          confidence: mock.confidence,
          researchProgress: mock.researchProgress,
          functionalityProgress: mock.functionalityProgress,
          testabilityProgress: mock.testabilityProgress,
          overallStatus: mock.overallStatus,
          realityGap: mock.realityGap,
          mainBlockersJson: mock.mainBlockersJson,
          progressBreakdownJson: mock.progressBreakdownJson,
          translations: {create: mock.translations}
        }
      }
    },
    include: {analyses: true}
  });
  const analysisId = hypothesis.analyses[0]?.id;
  const conditionData: Prisma.HypothesisConditionCreateManyInput[] = mock.conditions.map(c => ({
    hypothesisId: hypothesis.id,
    analysisId,
    title: c.title,
    description: c.description,
    status: c.status,
    importance: c.importance,
    confidence: c.confidence,
    completionScore: c.completionScore,
    knownWhat: c.knownWhat,
    unknownWhat: c.unknownWhat,
    blockers: c.blockers as Prisma.InputJsonValue,
    conflicts: c.conflicts as Prisma.InputJsonValue,
    requiredEvidence: c.requiredEvidence as Prisma.InputJsonValue,
    possibleWorkarounds: c.possibleWorkarounds as Prisma.InputJsonValue,
    testMethod: c.testMethod,
    ifSolvedImpactJson: c.ifSolvedImpactJson as Prisma.InputJsonValue,
    progressImpactJson: c.progressImpactJson as Prisma.InputJsonValue
  }));
  await prisma.hypothesisCondition.createMany({data: conditionData});
  await prisma.visualScene.create({data: {
    hypothesisId: hypothesis.id,
    analysisId,
    sceneType: mock.visualScene.sceneType,
    scale: mock.visualScene.scale,
    objectsJson: mock.visualScene.objectsJson as Prisma.InputJsonValue,
    variablesJson: mock.visualScene.variablesJson as Prisma.InputJsonValue,
    constraintsJson: mock.visualScene.constraintsJson as Prisma.InputJsonValue,
    measurementsJson: mock.visualScene.measurementsJson as Prisma.InputJsonValue
  }});
  const experimentData: Prisma.ExperimentProposalCreateManyInput[] = mock.experiments.map(e => ({
    hypothesisId: hypothesis.id,
    title: e.title,
    description: e.description,
    experimentType: e.experimentType,
    difficulty: e.difficulty,
    safetyLevel: e.safetyLevel,
    requiredEquipmentJson: e.requiredEquipmentJson as Prisma.InputJsonValue,
    expectedSignal: e.expectedSignal,
    falsificationCriteria: e.falsificationCriteria
  }));
  await prisma.experimentProposal.createMany({data: experimentData});
  const sourceData: Prisma.SourceReferenceCreateManyInput[] = mock.sources.map(s => ({
    hypothesisId: hypothesis.id,
    title: s.title,
    url: s.url,
    sourceType: s.sourceType,
    relationshipToHypothesis: s.relationshipToHypothesis,
    summary: s.summary
  }));
  await prisma.sourceReference.createMany({data: sourceData});

  redirect(`/${locale}/hypotheses/${hypothesis.id}`);
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
      projectId: condition.hypothesis.projectId,
      hypothesisId: condition.hypothesisId,
      conditionId: condition.id,
      title: localized.title,
      problemStatement: localized.description,
      whyItMatters: locale === 'ru'
        ? `Это условие имеет уровень «${getConditionImportanceLabel(condition.importance, locale)}» и необходимо для работоспособности гипотезы.`
        : `This condition is marked ${getConditionImportanceLabel(condition.importance, locale)} and is required for the hypothesis to work.`,
      ifSolvedImpact: jsonValueOrObject(localizeMockValue(condition.ifSolvedImpactJson, locale)),
      knownState: (locale === 'ru' ? {известно: localized.knownWhat} : {known: localized.knownWhat}) as Prisma.InputJsonValue,
      missingPieces: (locale === 'ru' ? {неизвестно: localized.unknownWhat, необходимые_данные: localized.requiredEvidence} : {unknown: localized.unknownWhat, requiredEvidence: localized.requiredEvidence}) as Prisma.InputJsonValue,
      blockers: jsonValueOrObject(localizeMockValue(condition.blockers, locale)),
      conflicts: jsonValueOrObject(localizeMockValue(condition.conflicts, locale)),
      possiblePaths: jsonValueOrObject(localizeMockValue(condition.possibleWorkarounds, locale)),
      currentBestPath: localized.testMethod,
      progressScore: condition.completionScore,
      events: {create: {type: 'STATUS_CHANGED', content: {message: locale === 'ru' ? 'Сессия поиска прорыва начата.' : 'Breakthrough session started.'} as Prisma.InputJsonValue}}
    }
  });
  redirect(`/${locale}/breakthroughs/${session.id}`);
}
