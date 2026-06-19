import {
  ConditionImportance,
  ConditionStatus,
  ExperimentCostLevel,
  ExperimentDifficulty,
  ExperimentStatus,
  ExperimentType,
  HypothesisOverallStatus,
  IdeaStatus,
  Locale,
  RealityGapLevel,
  SafetyLevel,
  Scale,
  SourceRelationship,
  SourceType,
  VerdictLevel,
} from '@prisma/client';

function normalizeEnum<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback;
}

export const normalizeLocale = (value: unknown, fallback: Locale = Locale.EN) => normalizeEnum(value, Object.values(Locale), fallback);
export const normalizeScale = (value: unknown, fallback: Scale = Scale.UNKNOWN) => normalizeEnum(value, Object.values(Scale), fallback);
export const normalizeVerdictLevel = (value: unknown) => normalizeEnum(value, Object.values(VerdictLevel), VerdictLevel.INSUFFICIENTLY_DEFINED);
export const normalizeOverallStatus = (value: unknown) => normalizeEnum(value, Object.values(HypothesisOverallStatus), HypothesisOverallStatus.UNDEFINED);
export const normalizeIdeaStatus = (value: unknown) => normalizeEnum(value, Object.values(IdeaStatus), IdeaStatus.NEEDS_REVIEW);
export const normalizeRealityGap = (value: unknown) => normalizeEnum(value, Object.values(RealityGapLevel), RealityGapLevel.UNKNOWN);
export const normalizeConditionStatus = (value: unknown) => normalizeEnum(value, Object.values(ConditionStatus), ConditionStatus.UNDEFINED);
export const normalizeConditionImportance = (value: unknown) => normalizeEnum(value, Object.values(ConditionImportance), ConditionImportance.MEDIUM);
export const normalizeExperimentCostLevel = (value: unknown) => normalizeEnum(value, Object.values(ExperimentCostLevel), ExperimentCostLevel.UNKNOWN);
export const normalizeExperimentType = (value: unknown) => normalizeEnum(value, Object.values(ExperimentType), ExperimentType.THOUGHT_EXPERIMENT);
export const normalizeExperimentDifficulty = (value: unknown) => normalizeEnum(value, Object.values(ExperimentDifficulty), ExperimentDifficulty.MEDIUM);
export const normalizeExperimentStatus = (value: unknown) => normalizeEnum(value, Object.values(ExperimentStatus), ExperimentStatus.PROPOSED);
export const normalizeSafetyLevel = (value: unknown) => normalizeEnum(value, Object.values(SafetyLevel), SafetyLevel.THEORETICAL_ONLY);
export const normalizeSourceType = (value: unknown) => normalizeEnum(value, Object.values(SourceType), SourceType.MOCK);
export const normalizeSourceRelationship = (value: unknown) => normalizeEnum(value, Object.values(SourceRelationship), SourceRelationship.BACKGROUND);

export function normalizeServiceKey(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[a-z][a-z0-9_]*$/.test(value) ? value : fallback;
}
