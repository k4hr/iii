import 'server-only';

import {ExperimentCostLevel, ExperimentDifficulty, ExperimentStatus, ExperimentType, SafetyLevel} from '@prisma/client';
import {getAiMode, getOpenAIClient} from '@/lib/ai/openai-client';
import {parseEngineeringModel} from '@/lib/engineering/engineering-model-schema';

export type ExperimentDesignerLocale = 'en' | 'ru';

export type ExperimentDesignerInput = {
  locale: string;
  hypothesis: {id: string; title: string; text: string};
  analysis?: {
    summary?: string | null;
    formalizedClaim?: string | null;
    scale?: string | null;
    realityGap?: string | null;
    researchProgress?: number | null;
    functionalityProgress?: number | null;
    testabilityProgress?: number | null;
  } | null;
  conditions?: Array<{
    id: string;
    title: string;
    description?: string | null;
    importance?: string | null;
    status?: string | null;
    testMethod?: string | null;
  }>;
  calculations?: Array<{
    id: string;
    title: string;
    conditionId?: string | null;
    resultJson?: unknown;
    explanation?: string | null;
  }>;
  sources?: Array<{
    id: string;
    title: string;
    conditionId?: string | null;
    summary?: string | null;
  }>;
  engineeringModelJson?: unknown;
  researchTasks?: Array<{type: string; title: string; description: string; targetSection?: string | null}>;
  breakthroughSessions?: Array<{id: string; conditionId?: string | null; title: string; problemStatement?: string | null}>;
  conditionId?: string;
  breakthroughSessionId?: string;
};

export type ExperimentPlan = {
  title: string;
  description: string;
  objective: string;
  hypothesisBeingTested: string;
  minimumViableTest: string;
  setup: Array<string>;
  equipment: Array<string>;
  independentVariables: Array<string>;
  dependentVariables: Array<string>;
  controlVariables: Array<string>;
  procedure: Array<string>;
  measurementMethod: string;
  dataToCollect: Array<string>;
  expectedResult: string;
  failureResult: string;
  successCriteria: Array<string>;
  risks: Array<string>;
  costLevel: ExperimentCostLevel;
  difficultyLevel: ExperimentDifficulty;
  safetyLevel: SafetyLevel;
  status: ExperimentStatus;
  experimentType: ExperimentType;
  nextStepAfterExperiment: string;
};

export async function designExperiment(input: ExperimentDesignerInput): Promise<ExperimentPlan> {
  if (getAiMode() === 'real') {
    try {
      const real = await designExperimentWithOpenAI(input);
      if (real) return normalizePlan(real, input);
    } catch {
      // Keep the MVP resilient: server-side OpenAI failures fall back to deterministic design.
    }
  }
  return designExperimentFallback(input);
}

async function designExperimentWithOpenAI(input: ExperimentDesignerInput): Promise<ExperimentPlan | null> {
  const client = getOpenAIClient();
  if (!client) return null;
  const locale = normalizeLocale(input.locale);
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    response_format: {type: 'json_object'},
    messages: [
      {
        role: 'system',
        content: [
          'Generate a practical experiment plan as strict JSON.',
          'Do not claim the hypothesis is proven.',
          'Return only fields: title, description, objective, hypothesisBeingTested, minimumViableTest, setup, equipment, independentVariables, dependentVariables, controlVariables, procedure, measurementMethod, dataToCollect, expectedResult, failureResult, successCriteria, risks, costLevel, difficultyLevel, safetyLevel, status, experimentType, nextStepAfterExperiment.',
          'Use enum values for costLevel LOW|MEDIUM|HIGH|EXTREME|UNKNOWN, difficultyLevel LOW|MEDIUM|HIGH|EXTREME, safetyLevel SAFE|CAUTION|LAB_ONLY|DANGEROUS|THEORETICAL_ONLY, status DRAFT|PROPOSED|READY|RUNNING|COMPLETED|FAILED|ARCHIVED, experimentType THOUGHT_EXPERIMENT|COMPUTER_SIMULATION|SMALL_LAB_TEST|PRECISION_MEASUREMENT|MATERIAL_TEST|SAFETY_TEST.',
          locale === 'ru' ? 'All human-readable text must be Russian.' : 'All human-readable text must be English.',
        ].join(' '),
      },
      {role: 'user', content: JSON.stringify(compactInput(input))},
    ],
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) return null;
  return JSON.parse(raw) as ExperimentPlan;
}

function designExperimentFallback(input: ExperimentDesignerInput): ExperimentPlan {
  const locale = normalizeLocale(input.locale);
  const ru = locale === 'ru';
  const condition = selectCondition(input);
  const calculation = selectCalculation(input, condition?.id);
  const engineering = parseEngineeringModel(input.engineeringModelJson);
  const module = engineering?.physicalModules.find(item => condition?.id && item.linkedConditionIds.includes(condition.id))
    ?? engineering?.physicalModules.find(item => item.category === 'measurement' || item.category === 'sensor')
    ?? engineering?.physicalModules[0];
  const source = input.sources?.find(item => condition?.id && item.conditionId === condition.id) ?? input.sources?.[0];
  const subject = condition?.title || input.hypothesis.title;
  const effect = condition?.testMethod || (ru ? 'измеримое отличие от контрольного сценария' : 'a measurable difference from the control scenario');
  const moduleName = module?.name || (ru ? 'тестируемый модуль' : 'tested module');
  const calculationHint = calculation ? `${calculation.title}: ${calculation.explanation || ''}`.trim() : '';

  return {
    title: ru ? `Минимальный тест: ${subject}` : `Minimum test: ${subject}`,
    description: ru
      ? `Практический протокол для проверки одного измеримого утверждения без заявления о решении всей гипотезы.`
      : 'A practical protocol for checking one measurable claim without treating the full hypothesis as solved.',
    objective: ru
      ? `Проверить, даёт ли ${moduleName} наблюдаемый сигнал для условия "${subject}".`
      : `Check whether ${moduleName} produces an observable signal for "${subject}".`,
    hypothesisBeingTested: input.analysis?.formalizedClaim || input.hypothesis.text,
    minimumViableTest: ru
      ? 'Уменьшенный стенд или расчётная симуляция с одной независимой переменной, одним контролем и заранее заданным порогом обнаружения.'
      : 'A reduced bench or simulation test with one independent variable, one control and a predefined detection threshold.',
    setup: ru
      ? [`Изолировать модуль: ${moduleName}.`, `Создать контрольный сценарий без заявленного эффекта.`, source ? `Сверить допущения с источником-кандидатом: ${source.title}.` : 'Зафиксировать исходные допущения перед запуском.']
      : [`Isolate module: ${moduleName}.`, 'Create a control scenario without the claimed effect.', source ? `Check assumptions against source candidate: ${source.title}.` : 'Freeze starting assumptions before the run.'],
    equipment: ru
      ? ['протокол измерений', 'датчик или расчётный мониторинг сигнала', 'контрольный образец/сценарий', 'журнал данных']
      : ['measurement protocol', 'sensor or simulation monitor', 'control sample/scenario', 'data log'],
    independentVariables: ru ? ['интенсивность воздействия', 'масштаб объекта', 'время наблюдения'] : ['effect intensity', 'object scale', 'observation time'],
    dependentVariables: ru ? ['измеренный сигнал', 'отношение сигнал/шум', 'отклонение от контроля'] : ['measured signal', 'signal-to-noise ratio', 'deviation from control'],
    controlVariables: ru ? ['температура', 'масса/геометрия образца', 'начальные условия', 'метод измерения'] : ['temperature', 'sample mass/geometry', 'initial conditions', 'measurement method'],
    procedure: ru
      ? ['Зафиксировать исходные параметры и критерий успеха.', 'Запустить контрольный сценарий и записать шумовой уровень.', 'Запустить тестовый сценарий с минимальным масштабом.', 'Повторить измерение не менее трёх раз.', 'Сравнить сигнал с шумом и расчётным порогом.', calculationHint ? `Проверить результат против расчёта: ${calculationHint}` : 'Записать, какие параметры сильнее всего меняют результат.']
      : ['Freeze starting parameters and success criteria.', 'Run the control scenario and record the noise floor.', 'Run the test scenario at minimum scale.', 'Repeat the measurement at least three times.', 'Compare signal against noise and the calculated threshold.', calculationHint ? `Check the result against calculation: ${calculationHint}` : 'Record which parameters move the result most.'],
    measurementMethod: ru
      ? 'Сравнить тестовый сигнал с контрольным уровнем и оценить порядок разрыва между требуемым и наблюдаемым эффектом.'
      : 'Compare the test signal with the control baseline and estimate the order-of-magnitude gap between required and observed effect.',
    dataToCollect: ru ? ['сырые измерения', 'контрольный шум', 'параметры запуска', 'расчётный разрыв', 'аномалии и сбои'] : ['raw measurements', 'control noise', 'run parameters', 'calculated gap', 'anomalies and failures'],
    expectedResult: ru ? `Если гипотеза частично верна, сигнал устойчиво превышает контрольный уровень.` : 'If the hypothesis is partly correct, the signal consistently exceeds the control baseline.',
    failureResult: ru ? 'Если сигнал не превышает шум или требует недостижимых параметров, путь считается заблокированным на текущем масштабе.' : 'If the signal does not exceed noise or requires unreachable parameters, this path is blocked at the current scale.',
    successCriteria: ru ? ['сигнал выше шума', 'результат повторяется', 'параметры не нарушают ограничения безопасности', 'разрыв уменьшается хотя бы на один порядок'] : ['signal exceeds noise', 'result is repeatable', 'parameters stay inside safety limits', 'gap improves by at least one order of magnitude'],
    risks: ru ? ['ложноположительный сигнал', 'неконтролируемый нагрев', 'невалидные допущения модели', 'опасность при масштабировании'] : ['false-positive signal', 'uncontrolled heating', 'invalid model assumptions', 'scale-up safety risk'],
    costLevel: ExperimentCostLevel.LOW,
    difficultyLevel: condition?.importance === 'CRITICAL' ? ExperimentDifficulty.MEDIUM : ExperimentDifficulty.LOW,
    safetyLevel: condition?.status === 'ENGINEERING_BLOCKED' ? SafetyLevel.CAUTION : SafetyLevel.SAFE,
    status: ExperimentStatus.PROPOSED,
    experimentType: engineering ? ExperimentType.SMALL_LAB_TEST : ExperimentType.THOUGHT_EXPERIMENT,
    nextStepAfterExperiment: ru
      ? 'Если критерий успеха выполнен, обновить инженерную модель и запустить расчёт следующего масштаба.'
      : 'If the success criteria pass, update the engineering model and run the next-scale calculation.',
  };
}

function normalizePlan(value: Partial<ExperimentPlan>, input: ExperimentDesignerInput): ExperimentPlan {
  const fallback = designExperimentFallback(input);
  return {
    ...fallback,
    ...value,
    setup: stringArray(value.setup, fallback.setup),
    equipment: stringArray(value.equipment, fallback.equipment),
    independentVariables: stringArray(value.independentVariables, fallback.independentVariables),
    dependentVariables: stringArray(value.dependentVariables, fallback.dependentVariables),
    controlVariables: stringArray(value.controlVariables, fallback.controlVariables),
    procedure: stringArray(value.procedure, fallback.procedure),
    dataToCollect: stringArray(value.dataToCollect, fallback.dataToCollect),
    successCriteria: stringArray(value.successCriteria, fallback.successCriteria),
    risks: stringArray(value.risks, fallback.risks),
    costLevel: enumValue(value.costLevel, Object.values(ExperimentCostLevel), fallback.costLevel),
    difficultyLevel: enumValue(value.difficultyLevel, Object.values(ExperimentDifficulty), fallback.difficultyLevel),
    safetyLevel: enumValue(value.safetyLevel, Object.values(SafetyLevel), fallback.safetyLevel),
    status: enumValue(value.status, Object.values(ExperimentStatus), fallback.status),
    experimentType: enumValue(value.experimentType, Object.values(ExperimentType), fallback.experimentType),
  };
}

function selectCondition(input: ExperimentDesignerInput) {
  return input.conditions?.find(item => item.id === input.conditionId)
    ?? input.conditions?.find(item => item.importance === 'CRITICAL')
    ?? input.conditions?.[0];
}

function selectCalculation(input: ExperimentDesignerInput, conditionId?: string) {
  return input.calculations?.find(item => conditionId && item.conditionId === conditionId) ?? input.calculations?.[0];
}

function normalizeLocale(locale: string): ExperimentDesignerLocale {
  return locale.toLowerCase() === 'ru' ? 'ru' : 'en';
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 12) : fallback;
}

function compactInput(input: ExperimentDesignerInput) {
  return {
    locale: normalizeLocale(input.locale),
    hypothesis: input.hypothesis,
    analysis: input.analysis,
    targetCondition: selectCondition(input),
    calculations: input.calculations?.slice(0, 5),
    sources: input.sources?.slice(0, 5),
    engineeringModel: parseEngineeringModel(input.engineeringModelJson),
    researchTasks: input.researchTasks?.slice(0, 8),
    breakthroughSessions: input.breakthroughSessions?.slice(0, 5),
  };
}
