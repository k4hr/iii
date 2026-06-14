import {IdeaStatus} from '@prisma/client';

export function evaluateBreakthroughIdea(rawText: string) {
  const promising = /scale|small|micro|measure|измер|уменьш|меньш|filter|membrane|мембран|резонанс|resonance/i.test(rawText);
  return {
    title: rawText.slice(0, 70) || 'User idea',
    formalizedText: `Formalized user hypothesis branch: ${rawText}`,
    status: promising ? IdeaStatus.PROMISING : IdeaStatus.NEEDS_FORMALIZATION,
    impactJson: {
      researchProgressDelta: promising ? 4 : 2,
      functionalityProgressDelta: promising ? 1 : 0,
      testabilityProgressDelta: promising ? 9 : 3,
      note: promising ? 'This idea may improve testability by narrowing the target or measurement.' : 'The idea needs sharper mechanism and variables before it can move progress.'
    },
    reviewJson: {
      establishedKnowledge: ['Must be separated from speculation and measured against known constraints.'],
      userHypothesis: rawText,
      calculatedEstimate: 'Mock estimate only; real calculator will be plugged in later.',
      unknownArea: ['Exact parameters are not defined yet.'],
      contradiction: [],
      requiredEvidence: ['Define variables, predicted effect and falsification criteria.']
    },
    assumptionsJson: ['The proposed mechanism can be parameterized.', 'A measurable signal can be defined.'],
    newBlockersJson: promising ? ['Requires parameter values and sensitivity estimate.'] : ['Mechanism remains ambiguous.']
  };
}
