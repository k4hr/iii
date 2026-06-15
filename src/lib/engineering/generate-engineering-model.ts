import 'server-only';

import {zodTextFormat} from 'openai/helpers/zod';
import {getOpenAIClient} from '@/lib/ai/openai-client';
import {
  engineeringModelSchema,
  type CanonicalEngineeringModel,
  type CanonicalEngineeringModule,
  type EngineeringGeometryHint,
  type EngineeringModuleCategory,
  type EngineeringPositionHint,
} from '@/lib/engineering/engineering-model-schema';

export type EngineeringSynthesisInput = {
  locale?: string | null;
  hypothesis: {id: string; title: string; text: string};
  analysis?: {
    summary?: string | null;
    formalizedClaim?: string | null;
    knownScience?: string | null;
    physicalConstraints?: unknown;
    engineeringConstraints?: unknown;
    contradictions?: unknown;
    unknowns?: unknown;
    mainBlockers?: unknown;
    researchProgress?: number | null;
    functionalityProgress?: number | null;
    testabilityProgress?: number | null;
    confidence?: number | null;
  } | null;
  conditions: Array<{
    id: string;
    title: string;
    description?: string | null;
    status?: string | null;
    importance?: string | null;
    completionScore?: number | null;
    blockers?: unknown;
    parentId?: string | null;
  }>;
  calculations: Array<{
    id: string;
    conditionId?: string | null;
    title: string;
    resultJson?: unknown;
    gapOrders?: number | null;
  }>;
  sources: Array<{id: string; conditionId?: string | null; title: string; relationship?: string | null}>;
  breakthroughSessions: Array<{id: string; conditionId: string; title: string; progressScore?: number | null}>;
};

const POSITION_ORDER: EngineeringPositionHint[] = ['center', 'left', 'right', 'top', 'bottom', 'front', 'rear', 'internal', 'external'];

export async function generateEngineeringModel(input: EngineeringSynthesisInput): Promise<CanonicalEngineeringModel> {
  try {
    const client = getOpenAIClient();
    if (!client) return synthesizeEngineeringModelFallback(input);

    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-5.5',
      instructions: [
        'You are the server-side Engineering Synthesis Layer for TheoryForge.',
        'Return a canonical engineering decomposition grounded only in the supplied hypothesis, analysis, conditions, calculations, sources and breakthrough sessions.',
        'Create functional modules rather than decorative parts. Link every module to relevant record IDs when possible.',
        'Use stable lowercase ASCII module IDs. Do not invent citations, measurements, completed breakthroughs, or verified feasibility.',
        'Feasibility scores are rough research-planning estimates from 0 to 100, not claims of scientific validity.',
        'Use geometryHint and positionHint to describe a lightweight procedural assembly.',
        `Write human-readable fields in ${isRussian(input.locale) ? 'Russian' : 'English'}.`,
      ].join(' '),
      input: JSON.stringify(compactInput(input)),
      text: {format: zodTextFormat(engineeringModelSchema, 'theoryforge_engineering_model')},
    });

    if (!response.output_parsed) throw new Error('OpenAI engineering synthesis returned no structured model.');
    return normalizeModel(response.output_parsed, input);
  } catch (error) {
    console.error('Engineering synthesis fell back to deterministic mode:', error instanceof Error ? error.message : error);
    return synthesizeEngineeringModelFallback(input);
  }
}

export function synthesizeEngineeringModelFallback(input: EngineeringSynthesisInput): CanonicalEngineeringModel {
  const ru = isRussian(input.locale);
  const corpus = normalizedCorpus(input);
  const materiality = detectMateriality(corpus);
  const artifactClass = detectArtifactClass(corpus, materiality);
  const conditionModules = input.conditions.slice(0, 10).map((condition, index) => moduleFromCondition(input, condition, index, ru));
  const requiredCategories = foundationCategories(artifactClass, materiality);
  const modules = dedupeModules([
    ...conditionModules,
    ...requiredCategories.map((category, index) => foundationModule(input, category, conditionModules.length + index, ru)),
  ]).slice(0, 14);

  if (modules.length < 2) {
    modules.push(foundationModule(input, 'measurement', modules.length, ru));
  }

  const linkedModules = modules.map((module, index) => ({
    ...module,
    dependsOnModuleIds: index === 0 ? [] : [modules[Math.max(0, index - 1)].id],
  }));
  const interfaces = linkedModules.slice(1).map((module, index) => ({
    fromModuleId: linkedModules[index].id,
    toModuleId: module.id,
    type: interfaceType(linkedModules[index].category, module.category),
  }));
  const progress = normalizePercent(input.analysis?.researchProgress);
  const functionality = normalizePercent(input.analysis?.functionalityProgress);
  const testability = normalizePercent(input.analysis?.testabilityProgress);
  const confidence = normalizePercent(input.analysis?.confidence);
  const largestGap = largestGapOrders(input.calculations);
  const averageFeasibility = Math.round(linkedModules.reduce((sum, module) => sum + module.feasibilityScore, 0) / linkedModules.length);

  return engineeringModelSchema.parse({
    materiality,
    artifactClass,
    artifactName: input.hypothesis.title.trim() || (ru ? 'Инженерная система' : 'Engineering system'),
    summary: input.analysis?.summary?.trim() || (ru
      ? 'Каноническая инженерная декомпозиция гипотезы на функциональные модули, интерфейсы и проверяемые ограничения.'
      : 'Canonical engineering decomposition of the hypothesis into functional modules, interfaces, and testable constraints.'),
    engineeringIntent: input.analysis?.formalizedClaim?.trim() || input.hypothesis.text.trim(),
    modules: linkedModules,
    interfaces,
    metrics: [
      metric('research', ru ? 'Исследование' : 'Research', progress),
      metric('functionality', ru ? 'Работоспособность' : 'Functionality', functionality),
      metric('testability', ru ? 'Проверяемость' : 'Testability', testability),
      metric('confidence', ru ? 'Уверенность' : 'Confidence', confidence),
      metric('module-feasibility', ru ? 'Готовность модулей' : 'Module feasibility', averageFeasibility),
    ],
    charts: [
      {id: 'feasibility', title: ru ? 'Готовность инженерных модулей' : 'Engineering module feasibility', type: 'feasibility', data: linkedModules.map(module => ({label: module.name, value: module.feasibilityScore}))},
      {id: 'testability', title: ru ? 'Профиль проверяемости' : 'Testability profile', type: 'testability', data: [{label: ru ? 'Исследование' : 'Research', value: progress}, {label: ru ? 'Функциональность' : 'Functionality', value: functionality}, {label: ru ? 'Проверяемость' : 'Testability', value: testability}]},
      ...(largestGap === null ? [] : [{id: 'energy-gap', title: ru ? 'Порядок основного разрыва' : 'Largest order-of-magnitude gap', type: 'energy_gap' as const, data: [{label: ru ? 'Разрыв' : 'Gap', value: largestGap}]}]),
    ],
    nextEngineeringStep: nextStep(linkedModules, materiality, ru),
  });
}

export function enrichEngineeringModelContext(model: CanonicalEngineeringModel, input: EngineeringSynthesisInput): CanonicalEngineeringModel {
  const modules = model.modules.map(module => {
    const conditionIds = new Set(module.linkedConditionIds);
    const categoryCalculations = input.calculations.filter(item =>
      (item.conditionId && conditionIds.has(item.conditionId)) || (!item.conditionId && detectCategory(item.title.toLowerCase()) === module.category)
    );
    const categorySources = input.sources.filter(item => item.conditionId && conditionIds.has(item.conditionId));
    const gapOrders = largestGapOrders(categoryCalculations);
    return {
      ...module,
      linkedCalculationIds: uniqueStrings([...module.linkedCalculationIds, ...categoryCalculations.map(item => item.id)]),
      linkedSourceIds: uniqueStrings([...module.linkedSourceIds, ...categorySources.map(item => item.id)]),
      ...(gapOrders === null ? {} : {gapOrders: Math.max(module.gapOrders ?? 0, gapOrders)}),
    };
  });
  return engineeringModelSchema.parse({...model, modules});
}

function moduleFromCondition(input: EngineeringSynthesisInput, condition: EngineeringSynthesisInput['conditions'][number], index: number, ru: boolean): CanonicalEngineeringModule {
  const text = `${condition.title} ${condition.description ?? ''} ${stringList(condition.blockers).join(' ')}`.toLowerCase();
  const category = detectCategory(text);
  const calculations = input.calculations.filter(item => item.conditionId === condition.id);
  const gapOrders = largestGapOrders(calculations);
  const sources = input.sources.filter(item => item.conditionId === condition.id);
  const importance = condition.importance?.toUpperCase();
  const blocked = /BLOCKED|BREAKTHROUGH|CONFLICT/.test(condition.status?.toUpperCase() ?? '');
  const priority = importance === 'CRITICAL' || blocked ? 'critical' : importance === 'HIGH' ? 'high' : importance === 'LOW' ? 'low' : 'medium';
  const score = normalizePercent(condition.completionScore);
  const id = uniqueId(condition.title, condition.id, index);

  return {
    id,
    name: condition.title.trim() || categoryLabel(category, ru),
    role: roleForCategory(category, ru),
    description: condition.description?.trim() || (ru ? 'Модуль реализует соответствующее условие инженерной модели.' : 'This module implements the corresponding engineering condition.'),
    category,
    priority,
    feasibilityScore: score,
    linkedConditionIds: [condition.id],
    linkedCalculationIds: calculations.map(item => item.id),
    linkedSourceIds: sources.map(item => item.id),
    blockerIds: priority === 'critical' ? [condition.id] : [],
    dependsOnModuleIds: [],
    geometryHint: geometryForCategory(category, text),
    positionHint: POSITION_ORDER[index % POSITION_ORDER.length],
    ...(gapOrders === null ? {} : {gapOrders}),
  };
}

function foundationModule(input: EngineeringSynthesisInput, category: EngineeringModuleCategory, index: number, ru: boolean): CanonicalEngineeringModule {
  const relatedCalculations = input.calculations.filter(item => detectCategory(item.title.toLowerCase()) === category);
  const gapOrders = largestGapOrders(relatedCalculations);
  return {
    id: `foundation-${category}`,
    name: categoryLabel(category, ru),
    role: roleForCategory(category, ru),
    description: foundationDescription(category, ru),
    category,
    priority: category === 'safety' ? 'high' : 'medium',
    feasibilityScore: category === 'measurement' ? normalizePercent(input.analysis?.testabilityProgress) : normalizePercent(input.analysis?.functionalityProgress),
    linkedConditionIds: [],
    linkedCalculationIds: relatedCalculations.map(item => item.id),
    linkedSourceIds: [],
    blockerIds: [],
    dependsOnModuleIds: [],
    geometryHint: geometryForCategory(category, ''),
    positionHint: POSITION_ORDER[index % POSITION_ORDER.length],
    ...(gapOrders === null ? {} : {gapOrders}),
  };
}

function normalizeModel(model: CanonicalEngineeringModel, input: EngineeringSynthesisInput): CanonicalEngineeringModel {
  const conditionIds = new Set(input.conditions.map(item => item.id));
  const calculationIds = new Set(input.calculations.map(item => item.id));
  const sourceIds = new Set(input.sources.map(item => item.id));
  const idMap = new Map(model.modules.map((module, index) => [module.id, uniqueId(module.id, module.id, index)]));
  const modules = model.modules.map(module => ({
    ...module,
    id: idMap.get(module.id) ?? module.id,
    feasibilityScore: normalizePercent(module.feasibilityScore),
    linkedConditionIds: module.linkedConditionIds.filter(id => conditionIds.has(id)),
    linkedCalculationIds: module.linkedCalculationIds.filter(id => calculationIds.has(id)),
    linkedSourceIds: module.linkedSourceIds.filter(id => sourceIds.has(id)),
  }));
  const ids = new Set(modules.map(module => module.id));
  return engineeringModelSchema.parse({
    ...model,
    modules: modules.map((module, index) => ({
      ...module,
      dependsOnModuleIds: model.modules[index].dependsOnModuleIds.map(id => idMap.get(id)).filter((id): id is string => Boolean(id && ids.has(id) && id !== module.id)),
    })),
    interfaces: model.interfaces.map(link => ({...link, fromModuleId: idMap.get(link.fromModuleId) ?? '', toModuleId: idMap.get(link.toModuleId) ?? ''})).filter(link => ids.has(link.fromModuleId) && ids.has(link.toModuleId) && link.fromModuleId !== link.toModuleId),
  });
}

function compactInput(input: EngineeringSynthesisInput) {
  return {
    locale: isRussian(input.locale) ? 'ru' : 'en',
    hypothesis: input.hypothesis,
    analysis: input.analysis,
    conditions: input.conditions.slice(0, 16),
    calculations: input.calculations.slice(0, 12),
    sources: input.sources.slice(0, 12),
    breakthroughSessions: input.breakthroughSessions.slice(0, 10),
  };
}

function normalizedCorpus(input: EngineeringSynthesisInput): string {
  return [input.hypothesis.title, input.hypothesis.text, input.analysis?.summary, input.analysis?.formalizedClaim, input.analysis?.knownScience, ...input.conditions.flatMap(item => [item.title, item.description])].filter(Boolean).join(' ').toLowerCase();
}

function detectMateriality(text: string): CanonicalEngineeringModel['materiality'] {
  const physical = /(device|machine|vehicle|material|energy|power|temperature|mass|sensor|reactor|battery|engine|костюм|машин|устройств|материал|энерг|температур|масса|датчик|реактор|батар|двигател|сверхпровод)/.test(text);
  const abstract = /(algorithm|theorem|logic|consciousness|ethic|social|mathematical proof|алгоритм|теорем|логик|сознани|этик|социальн|доказательств)/.test(text);
  return physical && abstract ? 'hybrid' : physical ? 'material' : abstract ? 'abstract' : 'hybrid';
}

function detectArtifactClass(text: string, materiality: CanonicalEngineeringModel['materiality']): CanonicalEngineeringModel['artifactClass'] {
  if (materiality === 'abstract') return 'unknown';
  if (/(vehicle|car|drone|aircraft|автомобил|машин|дрон|транспорт)/.test(text)) return 'vehicle';
  if (/(wearable|suit|armor|exoskeleton|костюм|брон|экзоскелет|ранец)/.test(text)) return 'wearable';
  if (/(battery|cell|lithium|аккумулятор|батар|литий)/.test(text)) return 'battery';
  if (/(reactor|fusion|fission|реактор|синтез)/.test(text)) return 'reactor';
  if (/(propulsion|engine|thrust|jet|двигател|тяга|реактив)/.test(text)) return 'propulsion';
  if (/(material|alloy|composite|superconduct|материал|сплав|композит|сверхпровод)/.test(text)) return 'material_system';
  if (/(sensor|detector|measurement device|датчик|детектор|измерител)/.test(text)) return 'sensor';
  if (/(infrastructure|plant|network|facility|инфраструктур|станци|комплекс)/.test(text)) return 'infrastructure';
  return 'device';
}

function foundationCategories(artifactClass: CanonicalEngineeringModel['artifactClass'], materiality: CanonicalEngineeringModel['materiality']): EngineeringModuleCategory[] {
  if (materiality === 'abstract') return ['structure', 'control', 'measurement'];
  const categories: EngineeringModuleCategory[] = ['structure', 'control', 'safety', 'measurement'];
  if (['vehicle', 'wearable', 'battery', 'reactor', 'propulsion', 'device', 'infrastructure'].includes(artifactClass)) categories.push('power');
  if (['vehicle', 'wearable', 'propulsion'].includes(artifactClass)) categories.push('propulsion');
  if (['battery', 'reactor', 'propulsion', 'material_system'].includes(artifactClass)) categories.push('thermal');
  if (['battery', 'reactor', 'material_system'].includes(artifactClass)) categories.push('material');
  return categories;
}

function detectCategory(text: string): EngineeringModuleCategory {
  const rules: Array<[EngineeringModuleCategory, RegExp]> = [
    ['power', /energy|power|battery|fuel|voltage|энерг|мощност|аккумулятор|топлив|напряжен/],
    ['propulsion', /thrust|propulsion|engine|rotor|flight|тяга|двигател|ротор|пол[её]т/],
    ['thermal', /heat|thermal|temperature|cool|тепл|температур|охлаж/],
    ['control', /control|stability|software|feedback|управлен|стабиль|алгоритм|обратн/],
    ['sensor', /sensor|detect|signal|датчик|детектор|сигнал/],
    ['measurement', /measure|test|experiment|sensitivity|измер|провер|эксперимент|чувствитель/],
    ['safety', /safe|hazard|failure|contain|безопас|опас|отказ|защит/],
    ['material', /material|strength|alloy|membrane|electrode|conduct|материал|прочност|сплав|мембран|электрод|провод/],
    ['structure', /structure|frame|shell|load|geometry|структур|каркас|корпус|нагруз|геометр/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? 'unknown';
}

function geometryForCategory(category: EngineeringModuleCategory, text: string): EngineeringGeometryHint {
  if (/rotor|ротор/.test(text)) return 'rotor';
  if (/cell|ячейк/.test(text)) return 'cell';
  if (/tank|reservoir|бак|резервуар/.test(text)) return 'tank';
  const map: Record<EngineeringModuleCategory, EngineeringGeometryHint> = {power: 'core', structure: 'shell', control: 'panel', thermal: 'ring', propulsion: 'tube', material: 'block', sensor: 'probe', safety: 'shell', measurement: 'probe', unknown: 'block'};
  return map[category];
}

function categoryLabel(category: EngineeringModuleCategory, ru: boolean): string {
  const labels = ru
    ? {power: 'Энергетический модуль', structure: 'Несущая структура', control: 'Система управления', thermal: 'Тепловой контур', propulsion: 'Движительная система', material: 'Материальная система', sensor: 'Сенсорный модуль', safety: 'Контур безопасности', measurement: 'Измерительный модуль', unknown: 'Функциональный модуль'}
    : {power: 'Power module', structure: 'Structural assembly', control: 'Control system', thermal: 'Thermal circuit', propulsion: 'Propulsion system', material: 'Material system', sensor: 'Sensor module', safety: 'Safety system', measurement: 'Measurement module', unknown: 'Functional module'};
  return labels[category];
}

function roleForCategory(category: EngineeringModuleCategory, ru: boolean): string {
  return ru ? `Реализует функцию категории «${categoryLabel(category, true)}» в общей инженерной архитектуре.` : `Implements the ${categoryLabel(category, false).toLowerCase()} function within the engineering architecture.`;
}

function foundationDescription(category: EngineeringModuleCategory, ru: boolean): string {
  return ru ? `Базовый модуль категории «${categoryLabel(category, true)}», необходимый для воспроизводимой инженерной модели.` : `Baseline ${categoryLabel(category, false).toLowerCase()} required for a reproducible engineering model.`;
}

function nextStep(modules: CanonicalEngineeringModule[], materiality: CanonicalEngineeringModel['materiality'], ru: boolean): string {
  if (materiality === 'abstract') return ru ? 'Определить физически измеримый носитель, входы и наблюдаемый выход до построения полноценной 3D-модели.' : 'Define a physically measurable carrier, inputs, and observable output before building a full 3D model.';
  const weakest = [...modules].sort((a, b) => a.feasibilityScore - b.feasibilityScore || priorityRank(b.priority) - priorityRank(a.priority))[0];
  return ru ? `Сформировать минимальный эксперимент для модуля «${weakest.name}» и измерить его ключевой предел.` : `Build a minimum experiment for “${weakest.name}” and measure its governing limit.`;
}

function metric(id: string, label: string, value: number) {
  return {id, label, value, unit: '%', status: value >= 65 ? 'ok' as const : value >= 35 ? 'warning' as const : 'critical' as const};
}

function interfaceType(from: EngineeringModuleCategory, to: EngineeringModuleCategory): CanonicalEngineeringModel['interfaces'][number]['type'] {
  if (from === 'power' || to === 'power') return 'energy';
  if (from === 'control' || to === 'control') return 'control';
  if (from === 'thermal' || to === 'thermal') return 'heat';
  if (from === 'sensor' || to === 'sensor' || from === 'measurement' || to === 'measurement') return 'signal';
  if (from === 'material' || to === 'material') return 'material_flow';
  return 'structural';
}

function largestGapOrders(calculations: EngineeringSynthesisInput['calculations']): number | null {
  return calculations.reduce<number | null>((largest, calculation) => {
    const result = record(calculation.resultJson);
    const candidate = finite(calculation.gapOrders) ?? finite(result.gapOrders) ?? finite(record(result.energyGap).ordersOfMagnitude) ?? finite(record(result.scaleGap).ordersOfMagnitude);
    return candidate === null ? largest : largest === null ? candidate : Math.max(largest, candidate);
  }, null);
}

function dedupeModules(modules: CanonicalEngineeringModule[]): CanonicalEngineeringModule[] {
  const seenCategories = new Set<string>();
  const ids = new Set<string>();
  return modules.filter(module => {
    if (ids.has(module.id)) return false;
    const foundation = module.id.startsWith('foundation-');
    if (foundation && seenCategories.has(module.category)) return false;
    ids.add(module.id);
    seenCategories.add(module.category);
    return true;
  });
}

function uniqueId(value: string, fallback: string, index: number): string {
  const normalized = value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return normalized || `module-${fallback.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || index + 1}`;
}

function normalizePercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value <= 1 ? value * 100 : value)));
}

function priorityRank(priority: CanonicalEngineeringModule['priority']): number {
  return {low: 0, medium: 1, high: 2, critical: 3}[priority];
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value * 10) / 10) : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isRussian(locale: string | null | undefined): boolean {
  return locale?.toLowerCase() === 'ru';
}
