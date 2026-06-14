import {HypothesisOverallStatus, Locale, RealityGapLevel, Scale, SourceRelationship, SourceType, VerdictLevel} from '@prisma/client';
import {generateConditionTree, conditionProgress} from './generate-condition-tree';
import {generateVisualScene} from './generate-visual-scene';
import {generateExperiments} from './generate-experiments';
import {isRu, localizeMockText, localizeMockValue, MockLocale} from '@/lib/locale/mock-copy';

export function analyzeHypothesisMock(input: {title: string; text: string; analysisLocale: Locale}) {
  const conditions = generateConditionTree(`${input.title}\n${input.text}`, input.analysisLocale);
  const progress = conditionProgress(conditions);
  const mainBlockers = conditions.filter(condition => condition.importance === 'CRITICAL').map(condition => condition.title).slice(0, 3);
  const visualScene = generateVisualScene(input.text, input.analysisLocale);
  const experiments = generateExperiments(input.text, input.analysisLocale);
  const kind = detectMockKind(input.text);

  return {
    canonicalJson: {input: {title: input.title, text: input.text}, modelType: kind === 'time' ? 'spacetime_field' : kind === 'battery' ? 'battery_system' : 'generic_system'},
    scale: visualScene.scale as Scale,
    verdictLevel: kind === 'time' ? VerdictLevel.PHYSICALLY_POSSIBLE_ENGINEERING_BLOCKED : VerdictLevel.TESTABLE_WITH_SMALL_EXPERIMENTS,
    confidence: 0.72,
    ...progress,
    overallStatus: kind === 'time' ? HypothesisOverallStatus.PHYSICS_PLAUSIBLE_ENGINEERING_BLOCKED : HypothesisOverallStatus.TESTABLE_MICRO_VERSION,
    realityGap: kind === 'time' ? RealityGapLevel.EXTREME : RealityGapLevel.HIGH,
    mainBlockersJson: mainBlockers,
    progressBreakdownJson: conditions.map(condition => ({title: condition.title, score: condition.completionScore, importance: condition.importance})),
    translations: [
      createMockAnalysisTranslation({...input, locale: Locale.EN}),
      createMockAnalysisTranslation({...input, locale: Locale.RU}),
    ],
    conditions,
    visualScene,
    experiments,
    sources: createMockSources(input.analysisLocale),
  };
}

export function createMockAnalysisTranslation(input: {title: string; text: string; locale: MockLocale}) {
  const kind = detectMockKind(input.text);
  const ru = isRu(input.locale);
  const summary = kind === 'time'
    ? 'The hypothesis is scientifically interesting but strongly blocked by energy density, stability and measurement scale. A smaller precision-measurement version is the best first path.'
    : kind === 'battery'
      ? 'The hypothesis has a known scientific basis but is limited by reversibility, filtration, degradation and safety. Several parts are testable in smaller experiments.'
      : 'The hypothesis needs a clearer mechanism, but can be decomposed into testable conditions and engineering constraints.';
  const target = kind === 'time' ? 'Field/chamber/measurement system' : kind === 'battery' ? 'Electrochemical cell' : 'Proposed system';
  const title = ru ? input.title.trim().toLocaleLowerCase('ru-RU') : input.title.trim();
  const physicalConstraints = kind === 'time' ? ['energy density', 'causality', 'measurement sensitivity'] : ['energy conservation', 'materials', 'environment'];
  const engineeringConstraints = kind === 'time' ? ['field stability', 'thermal load', 'object safety'] : ['degradation', 'manufacturing', 'safety'];
  const contradictions = kind === 'time' ? ['Past-directed travel interpretations can conflict with causality.'] : [];
  const unknowns = ['Exact parameters are not defined yet.', 'Additional evidence and source validation are required.'];
  const rescuePaths = kind === 'time'
    ? ['Reduce to precision clock experiment', 'Improve measurement sensitivity', 'Change scale']
    : ['Reduce to component test', 'Prototype filtration', 'Cycle-life simulation'];
  const minimalExperiments = kind === 'time'
    ? ['Clock comparison estimate', 'Energy density calculation']
    : ['Membrane flow model', 'Small coupon filtration test'];

  return {
    locale: ru ? Locale.RU : Locale.EN,
    summary: localizeMockText(summary, input.locale),
    formalizedClaim: ru ? `Формализованная научная гипотеза: ${title}` : `Formalized scientific hypothesis: ${title}`,
    targetObject: localizeMockText(target, input.locale),
    knownScience: localizeMockText('The system separates established knowledge from assumptions and user hypotheses.', input.locale),
    physicalConstraints: localizeMockValue(physicalConstraints, input.locale),
    engineeringConstraints: localizeMockValue(engineeringConstraints, input.locale),
    contradictions: localizeMockValue(contradictions, input.locale),
    unknowns: localizeMockValue(unknowns, input.locale),
    rescuePaths: localizeMockValue(rescuePaths, input.locale),
    minimalExperiments: localizeMockValue(minimalExperiments, input.locale),
    verdictText: localizeMockText('Preliminary analysis: further checks and calculations are required.', input.locale),
  };
}

export function createMockSources(locale: MockLocale) {
  return [
    {
      title: localizeMockText('Scientific background source', locale),
      url: null,
      sourceType: SourceType.MOCK,
      relationshipToHypothesis: SourceRelationship.BACKGROUND,
      summary: localizeMockText('Background reference for the current hypothesis analysis.', locale),
    },
    {
      title: localizeMockText('Engineering limitation note', locale),
      url: null,
      sourceType: SourceType.MOCK,
      relationshipToHypothesis: SourceRelationship.ENGINEERING_LIMIT,
      summary: localizeMockText('Engineering constraints relevant to the proposed system.', locale),
    },
  ];
}

export function detectMockKind(text: string): 'time' | 'battery' | 'generic' {
  const lower = text.toLowerCase();
  if (/time|врем|spacetime|field|поле|quantum/.test(lower)) return 'time';
  if (/battery|лит|lithium|energy|power|батар|энерг/.test(lower)) return 'battery';
  return 'generic';
}
