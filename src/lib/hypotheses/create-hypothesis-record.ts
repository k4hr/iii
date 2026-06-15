import {HypothesisStatus, Locale, PrismaClient, Scale} from '@prisma/client';
import {analyzeHypothesisMock} from '@/lib/ai/analyze-hypothesis';
import {createCanonicalHypothesis} from '@/lib/ai/create-canonical-hypothesis';
import {detectLanguage} from '@/lib/ai/detect-language';
import {routeLocaleToPrisma} from '@/lib/locale/locale';
import {
  normalizeConditionImportance,
  normalizeConditionStatus,
  normalizeExperimentDifficulty,
  normalizeExperimentType,
  normalizeLocale,
  normalizeOverallStatus,
  normalizeRealityGap,
  normalizeSafetyLevel,
  normalizeScale,
  normalizeServiceKey,
  normalizeSourceRelationship,
  normalizeSourceType,
  normalizeVerdictLevel,
} from '@/lib/prisma/normalize-enums';
import {toPrismaJsonArray, toPrismaJsonObject} from '@/lib/prisma/safe-json';

export type CreateHypothesisRecordInput = {
  ownerId: string;
  projectId?: string;
  title: string;
  rawText: string;
  domain?: string;
  locale?: string;
};

export async function createHypothesisRecord(prisma: PrismaClient, input: CreateHypothesisRecordInput) {
  const title = input.title.trim();
  const rawText = input.rawText.trim();
  if (!title || !rawText) throw new Error('Hypothesis title and text are required.');

  const originalLocale = normalizeLocale(detectLanguage(`${title}\n${rawText}`), Locale.EN);
  const analysisLocale = normalizeLocale(routeLocaleToPrisma(input.locale || ''), Locale.EN);
  const canonical = createCanonicalHypothesis({title, text: rawText, locale: originalLocale});
  const mock = analyzeHypothesisMock({title, text: rawText, analysisLocale});
  const scene: Record<string, unknown> = isRecord(mock.visualScene) ? mock.visualScene : {};

  return prisma.$transaction(async tx => {
    const hypothesis = await tx.hypothesis.create({
      data: {
        ownerId: input.ownerId,
        ...(input.projectId ? {projectId: input.projectId} : {}),
        originalLocale,
        originalTitle: title,
        originalText: rawText,
        canonicalTitleEn: canonical.canonicalTitleEn || title,
        canonicalTextEn: canonical.canonicalTextEn || rawText,
        interfaceLocaleAtCreate: analysisLocale,
        analysisLocale,
        ...(input.domain ? {domain: input.domain} : {}),
        status: HypothesisStatus.DONE,
      },
      select: {id: true},
    });

    await tx.hypothesisVersion.create({
      data: {
        hypothesisId: hypothesis.id,
        versionNumber: 1,
        title,
        text: rawText,
        canonicalTextEn: canonical.canonicalTextEn || rawText,
        changeSummary: 'Initial version',
      },
    });

    const analysis = await tx.hypothesisAnalysis.create({
      data: {
        hypothesisId: hypothesis.id,
        canonicalJson: toPrismaJsonObject(mock.canonicalJson),
        scale: normalizeScale(mock.scale, Scale.UNKNOWN),
        verdictLevel: normalizeVerdictLevel(mock.verdictLevel),
        confidence: finiteNumber(mock.confidence, 0),
        researchProgress: finiteNumber(mock.researchProgress, 0),
        functionalityProgress: finiteNumber(mock.functionalityProgress, 0),
        testabilityProgress: finiteNumber(mock.testabilityProgress, 0),
        overallStatus: normalizeOverallStatus(mock.overallStatus),
        realityGap: normalizeRealityGap(mock.realityGap),
        mainBlockersJson: toPrismaJsonArray(mock.mainBlockersJson),
        progressBreakdownJson: toPrismaJsonArray(mock.progressBreakdownJson),
      },
      select: {id: true, scale: true},
    });

    await tx.hypothesisAnalysisTranslation.createMany({
      data: mock.translations.map(translation => ({
        analysisId: analysis.id,
        locale: normalizeLocale(translation.locale, analysisLocale),
        summary: stringValue(translation.summary),
        formalizedClaim: stringValue(translation.formalizedClaim),
        targetObject: optionalString(translation.targetObject),
        knownScience: stringValue(translation.knownScience),
        physicalConstraints: toPrismaJsonArray(translation.physicalConstraints),
        engineeringConstraints: toPrismaJsonArray(translation.engineeringConstraints),
        contradictions: toPrismaJsonArray(translation.contradictions),
        unknowns: toPrismaJsonArray(translation.unknowns),
        rescuePaths: toPrismaJsonArray(translation.rescuePaths),
        minimalExperiments: toPrismaJsonArray(translation.minimalExperiments),
        verdictText: stringValue(translation.verdictText),
      })),
    });

    await tx.hypothesisCondition.createMany({
      data: mock.conditions.map(condition => ({
        hypothesisId: hypothesis.id,
        analysisId: analysis.id,
        title: stringValue(condition.title),
        description: stringValue(condition.description),
        status: normalizeConditionStatus(condition.status),
        importance: normalizeConditionImportance(condition.importance),
        confidence: finiteNumber(condition.confidence, 0),
        completionScore: finiteNumber(condition.completionScore, 0),
        knownWhat: optionalString(condition.knownWhat),
        unknownWhat: optionalString(condition.unknownWhat),
        blockers: toPrismaJsonArray(condition.blockers),
        conflicts: toPrismaJsonArray(condition.conflicts),
        requiredEvidence: toPrismaJsonArray(condition.requiredEvidence),
        possibleWorkarounds: toPrismaJsonArray(condition.possibleWorkarounds),
        testMethod: optionalString(condition.testMethod),
        ifSolvedImpactJson: toPrismaJsonObject(condition.ifSolvedImpactJson),
        progressImpactJson: toPrismaJsonObject(condition.progressImpactJson),
      })),
    });

    const visualScene = await tx.visualScene.create({
      data: {
        hypothesisId: hypothesis.id,
        analysisId: analysis.id,
        sceneType: normalizeServiceKey(scene.sceneType, 'generic_model'),
        scale: normalizeScale(scene.scale, Scale.UNKNOWN),
        objectsJson: toPrismaJsonArray(scene.objectsJson),
        variablesJson: toPrismaJsonArray(scene.variablesJson),
        constraintsJson: toPrismaJsonArray(scene.constraintsJson),
        measurementsJson: toPrismaJsonArray(scene.measurementsJson),
      },
      select: {id: true, sceneType: true, scale: true},
    });

    await tx.experimentProposal.createMany({
      data: mock.experiments.map(experiment => ({
        hypothesisId: hypothesis.id,
        title: stringValue(experiment.title),
        description: stringValue(experiment.description),
        experimentType: normalizeExperimentType(experiment.experimentType),
        difficulty: normalizeExperimentDifficulty(experiment.difficulty),
        safetyLevel: normalizeSafetyLevel(experiment.safetyLevel),
        requiredEquipmentJson: toPrismaJsonArray(experiment.requiredEquipmentJson),
        expectedSignal: optionalString(experiment.expectedSignal),
        falsificationCriteria: optionalString(experiment.falsificationCriteria),
      })),
    });

    await tx.sourceReference.createMany({
      data: mock.sources.map(source => ({
        hypothesisId: hypothesis.id,
        title: stringValue(source.title),
        url: optionalString(source.url),
        sourceType: normalizeSourceType(source.sourceType),
        relationshipToHypothesis: normalizeSourceRelationship(source.relationshipToHypothesis),
        summary: stringValue(source.summary),
      })),
    });

    return {hypothesisId: hypothesis.id, analysisId: analysis.id, analysisScale: analysis.scale, visualScene};
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
