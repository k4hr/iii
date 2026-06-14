import {ConditionImportance, ConditionStatus} from '@prisma/client';

export type ProgressCondition = {
  completionScore: number;
  importance: ConditionImportance;
  status: ConditionStatus;
};

const weights: Record<ConditionImportance, number> = {LOW: 1, MEDIUM: 2, HIGH: 4, CRITICAL: 8};

export function calculateProgress(conditions: ProgressCondition[]) {
  if (!conditions.length) return {researchProgress: 5, functionalityProgress: 1, testabilityProgress: 1};
  const weighted = conditions.reduce((acc, c) => acc + c.completionScore * weights[c.importance], 0);
  const total = conditions.reduce((acc, c) => acc + weights[c.importance], 0);
  let functionality = Math.round(weighted / total);
  const criticalMin = Math.min(...conditions.filter(c => c.importance === 'CRITICAL').map(c => c.completionScore), 100);
  if (criticalMin < 10) functionality = Math.min(functionality, 15);
  const testable = conditions.filter(c => c.status === 'TESTABLE' || c.status === 'KNOWN_LIMITED');
  const testabilityProgress = Math.min(90, Math.round((testable.length / conditions.length) * 60 + 12));
  const researchProgress = Math.min(95, Math.round(35 + conditions.length * 5));
  return {researchProgress, functionalityProgress: functionality, testabilityProgress};
}
