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

function toPrismaJson(value: unknown, fallback: unknown = {}): Prisma.InputJsonValue {
  const safeValue = value === undefined ? fallback : value;
  return JSON.parse(JSON.stringify(safeValue ?? fallback)) as Prisma.InputJsonValue;
}

function toPrismaJsonArray(value: unknown): Prisma.InputJsonValue {
  return toPrismaJson(Array.isArray(value) ? value : [], []);
}

function jsonValueOrObject(value: unknown): Prisma.InputJsonValue {
  return toPrismaJson(value, {});
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

  const hypothesis = await prisma.$transaction(async tx => {
    const createdHypothesis = await tx.hypothesis.create({
      data: {
        ownerId: user.id,
        originalLocale,
        originalTitle: title,
        originalText: rawText,
        canonicalTitleEn: canonical.canonicalTitleEn,
        canonicalTextEn: canonical.canonicalTextEn,
        interfaceLocaleAtCreate: routeLocaleToPrisma(locale),
        analysisLocale,
        ...(domain ? {domain} : {}),
        ...(project?.id ? {projectId: project.id} : {}),
        status: 'DONE',
      },
      select: {id: true}
    });

    await tx.hypothesisVersion.create({
      data: {
        hypothesisId: createdHypothesis.id,
        versionNumber: 1,
        title,
        text: rawText,
        canonicalTextEn: canonical.canonicalTextEn,
        changeSummary: 'Initial version',
      }
    });

    const analysis = await tx.hypothesisAnalysis.create({
      data: {
        hypothesisId: createdHypothesis.id,
        canonicalJson: toPrismaJson(mock.canonicalJson),
        scale: mock.scale,
        verdictLevel: mock.verdictLevel,
        confidence: mock.confidence,
        researchProgress: mock.researchProgress,
        functionalityProgress: mock.functionalityProgress,
        testabilityProgress: mock.testabilityProgress,
        overallStatus: mock.overallStatus,
        realityGap: mock.realityGap,
        mainBlockersJson: toPrismaJsonArray(mock.mainBlockersJson),
        progressBreakdownJson: toPrismaJsonArray(mock.progressBreakdownJson),
      },
      select: {id: true}
    });

    await tx.hypothesisAnalysisTranslation.createMany({
      data: mock.translations.map(translation => ({
        analysisId: analysis.id,
        locale: translation.locale,
        summary: translation.summary,
        formalizedClaim: translation.formalizedClaim,
        targetObject: translation.targetObject,
        knownScience: translation.knownScience,
        physicalConstraints: toPrismaJsonArray(translation.physicalConstraints),
        engineeringConstraints: toPrismaJsonArray(translation.engineeringConstraints),
        contradictions: toPrismaJsonArray(translation.contradictions),
        unknowns: toPrismaJsonArray(translation.unknowns),
        rescuePaths: toPrismaJsonArray(translation.rescuePaths),
        minimalExperiments: toPrismaJsonArray(translation.minimalExperiments),
        verdictText: translation.verdictText,
      }))
    });

    const conditionData: Prisma.HypothesisConditionCreateManyInput[] = mock.conditions.map(c => ({
      hypothesisId: createdHypothesis.id,
      analysisId: analysis.id,
      title: c.title,
      description: c.description,
      status: c.status,
      importance: c.importance,
      confidence: c.confidence,
      completionScore: c.completionScore,
      knownWhat: c.knownWhat,
      unknownWhat: c.unknownWhat,
      blockers: toPrismaJsonArray(c.blockers),
      conflicts: toPrismaJsonArray(c.conflicts),
      requiredEvidence: toPrismaJsonArray(c.requiredEvidence),
      possibleWorkarounds: toPrismaJsonArray(c.possibleWorkarounds),
      testMethod: c.testMethod,
      ifSolvedImpactJson: toPrismaJson(c.ifSolvedImpactJson),
      progressImpactJson: toPrismaJson(c.progressImpactJson),
    }));
    await tx.hypothesisCondition.createMany({data: conditionData});

    await tx.visualScene.create({data: {
      hypothesisId: createdHypothesis.id,
      analysisId: analysis.id,
      sceneType: mock.visualScene.sceneType,
      scale: mock.visualScene.scale,
      objectsJson: toPrismaJsonArray(mock.visualScene.objectsJson),
      variablesJson: toPrismaJsonArray(mock.visualScene.variablesJson),
      constraintsJson: toPrismaJsonArray(mock.visualScene.constraintsJson),
      measurementsJson: toPrismaJsonArray(mock.visualScene.measurementsJson),
    }});

    const experimentData: Prisma.ExperimentProposalCreateManyInput[] = mock.experiments.map(e => ({
      hypothesisId: createdHypothesis.id,
      title: e.title,
      description: e.description,
      experimentType: e.experimentType,
      difficulty: e.difficulty,
      safetyLevel: e.safetyLevel,
      requiredEquipmentJson: toPrismaJsonArray(e.requiredEquipmentJson),
      expectedSignal: e.expectedSignal,
      falsificationCriteria: e.falsificationCriteria,
    }));
    await tx.experimentProposal.createMany({data: experimentData});

    const sourceData: Prisma.SourceReferenceCreateManyInput[] = mock.sources.map(s => ({
      hypothesisId: createdHypothesis.id,
      title: s.title,
      url: s.url,
      sourceType: s.sourceType,
      relationshipToHypothesis: s.relationshipToHypothesis,
      summary: s.summary,
    }));
    await tx.sourceReference.createMany({data: sourceData});

    return createdHypothesis;
  });

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
