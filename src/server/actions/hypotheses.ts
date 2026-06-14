'use server';

import {redirect} from 'next/navigation';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db/prisma';
import {detectLanguage} from '@/lib/ai/detect-language';
import {createCanonicalHypothesis} from '@/lib/ai/create-canonical-hypothesis';
import {analyzeHypothesisMock} from '@/lib/ai/analyze-hypothesis';
import {routeLocaleToPrisma} from '@/lib/locale/locale';

function jsonValueOrObject(value: Prisma.JsonValue | null | undefined): Prisma.InputJsonValue {
  if (value === null || value === undefined) return {};
  return value as Prisma.InputJsonValue;
}

export async function createProjectAction(locale: string, formData: FormData) {
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!title) return;
  await prisma.project.create({data: {title, description}});
  redirect(`/${locale}/projects`);
}

export async function createHypothesisAction(locale: string, formData: FormData) {
  const title = String(formData.get('title') || '').trim();
  const rawText = String(formData.get('rawText') || '').trim();
  const domain = String(formData.get('domain') || '').trim() || undefined;
  const projectId = String(formData.get('projectId') || '').trim() || undefined;
  if (!title || !rawText) return;

  const originalLocale = detectLanguage(`${title}\n${rawText}`);
  const analysisLocale = routeLocaleToPrisma(locale);
  const canonical = createCanonicalHypothesis({title, text: rawText, locale: originalLocale});
  const mock = analyzeHypothesisMock({title: canonical.canonicalTitleEn, text: canonical.canonicalTextEn, analysisLocale});

  const hypothesis = await prisma.hypothesis.create({
    data: {
      originalLocale,
      originalTitle: title,
      originalText: rawText,
      canonicalTitleEn: canonical.canonicalTitleEn,
      canonicalTextEn: canonical.canonicalTextEn,
      interfaceLocaleAtCreate: routeLocaleToPrisma(locale),
      analysisLocale,
      domain,
      projectId,
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
  const condition = await prisma.hypothesisCondition.findUnique({include: {hypothesis: true}, where: {id: conditionId}});
  if (!condition) return;
  const session = await prisma.breakthroughSession.create({
    data: {
      projectId: condition.hypothesis.projectId,
      hypothesisId: condition.hypothesisId,
      conditionId: condition.id,
      title: condition.title,
      problemStatement: condition.description,
      whyItMatters: `This condition is marked ${condition.importance} for the hypothesis to work.`,
      ifSolvedImpact: jsonValueOrObject(condition.ifSolvedImpactJson),
      knownState: {knownWhat: condition.knownWhat} as Prisma.InputJsonValue,
      missingPieces: {unknownWhat: condition.unknownWhat, requiredEvidence: condition.requiredEvidence} as Prisma.InputJsonValue,
      blockers: jsonValueOrObject(condition.blockers),
      conflicts: jsonValueOrObject(condition.conflicts),
      possiblePaths: jsonValueOrObject(condition.possibleWorkarounds),
      currentBestPath: condition.testMethod,
      progressScore: condition.completionScore,
      events: {create: {type: 'STATUS_CHANGED', content: {message: 'Breakthrough session started'} as Prisma.InputJsonValue}}
    }
  });
  redirect(`/${locale}/breakthroughs/${session.id}`);
}
