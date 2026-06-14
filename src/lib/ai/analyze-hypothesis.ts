import {Locale, RealityGapLevel, HypothesisOverallStatus, VerdictLevel, Scale, SourceRelationship, SourceType} from '@prisma/client';
import {generateConditionTree, conditionProgress} from './generate-condition-tree';
import {generateVisualScene} from './generate-visual-scene';
import {generateExperiments} from './generate-experiments';

export function analyzeHypothesisMock(input: {title: string; text: string; analysisLocale: Locale}) {
  const conditions = generateConditionTree(`${input.title}\n${input.text}`);
  const progress = conditionProgress(conditions);
  const mainBlockers = conditions.filter(c => c.importance === 'CRITICAL').map(c => c.title).slice(0, 3);
  const visualScene = generateVisualScene(input.text);
  const lower = input.text.toLowerCase();
  const isTime = /time|врем|field|поле/.test(lower);
  const isBattery = /battery|лит|lithium|батар/.test(lower);
  const summaryEn = isTime
    ? 'The hypothesis is scientifically interesting but strongly blocked by energy density, stability and measurement scale. A smaller precision-measurement version is the best first path.'
    : isBattery
      ? 'The hypothesis has a known scientific basis but is limited by reversibility, filtration, degradation and safety. Several parts are testable in smaller experiments.'
      : 'The hypothesis needs a clearer mechanism, but can be decomposed into testable conditions and engineering constraints.';
  const summaryRu = isTime
    ? 'Гипотеза научно интересная, но сильно упирается в плотность энергии, стабильность и масштаб измерений. Лучший первый путь — уменьшенная версия через точное измерение.'
    : isBattery
      ? 'У гипотезы есть известная научная база, но её ограничивают обратимость, фильтрация, деградация и безопасность. Часть условий можно проверять малыми экспериментами.'
      : 'Гипотезе нужен более чёткий механизм, но её можно разложить на проверяемые условия и инженерные ограничения.';

  return {
    canonicalJson: {input, modelType: isTime ? 'spacetime_field' : isBattery ? 'battery_system' : 'generic_system'},
    scale: visualScene.scale as Scale,
    verdictLevel: isTime ? VerdictLevel.PHYSICALLY_POSSIBLE_ENGINEERING_BLOCKED : VerdictLevel.TESTABLE_WITH_SMALL_EXPERIMENTS,
    confidence: 0.72,
    ...progress,
    overallStatus: isTime ? HypothesisOverallStatus.PHYSICS_PLAUSIBLE_ENGINEERING_BLOCKED : HypothesisOverallStatus.TESTABLE_MICRO_VERSION,
    realityGap: isTime ? RealityGapLevel.EXTREME : RealityGapLevel.HIGH,
    mainBlockersJson: mainBlockers,
    progressBreakdownJson: conditions.map(c => ({title: c.title, score: c.completionScore, importance: c.importance})),
    translations: [
      translation(Locale.EN, summaryEn, input.title, isTime, isBattery),
      translation(Locale.RU, summaryRu, input.title, isTime, isBattery)
    ],
    conditions,
    visualScene,
    experiments: generateExperiments(input.text),
    sources: [
      {title:'Mock scientific background source', url:null, sourceType:SourceType.MOCK, relationshipToHypothesis:SourceRelationship.BACKGROUND, summary:'Placeholder source until arXiv/Semantic Scholar integration is enabled.'},
      {title:'Mock engineering limitation note', url:null, sourceType:SourceType.MOCK, relationshipToHypothesis:SourceRelationship.ENGINEERING_LIMIT, summary:'Placeholder limitation source used by the MVP.'}
    ]
  };
}

function translation(locale: Locale, summary: string, title: string, isTime: boolean, isBattery: boolean) {
  const ru = locale === Locale.RU;
  return {
    locale,
    summary,
    formalizedClaim: ru ? `Формализованная версия: ${title}` : `Formalized claim: ${title}`,
    targetObject: isTime ? (ru ? 'Поле/камера/измерительная система' : 'Field/chamber/measurement system') : isBattery ? (ru ? 'Электрохимическая ячейка' : 'Electrochemical cell') : (ru ? 'Предлагаемая система' : 'Proposed system'),
    knownScience: ru ? 'Система отделяет известные факты от предположений и пользовательских гипотез.' : 'The system separates established knowledge from assumptions and user hypotheses.',
    physicalConstraints: isTime ? ['energy density','causality','measurement sensitivity'] : ['energy conservation','materials','environment'],
    engineeringConstraints: isTime ? ['field stability','thermal load','object safety'] : ['degradation','manufacturing','safety'],
    contradictions: isTime ? ['Past-directed travel interpretations can conflict with causality.'] : [],
    unknowns: ['Exact parameters are not defined yet.','Real source-backed analysis is not connected in the MVP.'],
    rescuePaths: isTime ? ['Reduce to precision clock experiment','Improve measurement sensitivity','Change scale'] : ['Reduce to component test','Prototype filtration','Cycle-life simulation'],
    minimalExperiments: isTime ? ['Clock comparison estimate','Energy density calculation'] : ['Membrane flow model','Small coupon filtration test'],
    verdictText: ru ? 'Предварительный mock-вердикт: требуется дальнейшая проверка и расчёты.' : 'Preliminary mock verdict: further checks and calculations are required.'
  };
}
