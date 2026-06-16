import 'server-only';

import {zodTextFormat} from 'openai/helpers/zod';
import {getOpenAIClient} from '@/lib/ai/openai-client';
import {
  engineeringModelSchema,
  type CanonicalEngineeringModel,
  type CanonicalEngineeringGeometryPlan,
  type CanonicalEngineeringGeometryPrimitive,
  type CanonicalEngineeringPhysicalModule,
  type CanonicalEngineeringResearchOverlay,
  type EngineeringPhysicalCategory,
  type EngineeringPhysicalGeometryHint,
  type EngineeringGeometryMaterialRole,
  type EngineeringPositionHint,
  type EngineeringSeverity,
  type Vector3Tuple,
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
  calculations: Array<{id: string; conditionId?: string | null; title: string; resultJson?: unknown; gapOrders?: number | null}>;
  sources: Array<{id: string; conditionId?: string | null; title: string; relationship?: string | null}>;
  experiments?: Array<{id: string; title: string; conditionId?: string | null}>;
  breakthroughSessions: Array<{id: string; conditionId: string; title: string; progressScore?: number | null}>;
};

type ModuleTemplate = Omit<CanonicalEngineeringPhysicalModule, 'feasibilityScore' | 'linkedConditionIds' | 'linkedCalculationIds' | 'linkedSourceIds'> & {
  keywords: string[];
};

export async function generateEngineeringModel(input: EngineeringSynthesisInput): Promise<CanonicalEngineeringModel> {
  try {
    const client = getOpenAIClient();
    if (!client) return synthesizeEngineeringModelFallback(input);

    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-5.5',
      instructions: [
        'You are the server-side Engineering Synthesis Layer for TheoryForge.',
        'Separate physical artifact architecture from research constraints.',
        'The 3D model must be based on physicalModules only: hardware parts, material layers, housings, power systems, controls, safety systems and measurement hardware.',
        'Do not turn research blockers, assumptions or condition titles into physicalModules unless no physical artifact can be inferred.',
        'Map blockers, calculations, sources, experiments and breakthrough sessions into researchOverlays attached to the closest physical module.',
        'Generate geometryPlan as the universal procedural render plan: primitives are lightweight geometric parts linked to moduleId, and connectors link primitive IDs.',
        'Do not rely on artifact-specific frontend renderers. The frontend will render geometryPlan exactly.',
        'Infer form factor, symmetry, support structure, energy path, control loop, actuation or force path, thermal path, measurement, safety layers and material interfaces from the hypothesis. Do not treat named examples as a supported-object whitelist.',
        'Use stable lowercase ASCII IDs. Do not invent verified citations, solved breakthroughs, or real measurements.',
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
  const templates = buildPhysicalArchitecture(artifactClass, corpus, ru);
  const conditionToModule = new Map<string, string>();

  const physicalModules = templates.map(template => {
    const linkedConditions = input.conditions.filter(condition => bestModuleForText(`${condition.title} ${condition.description ?? ''}`, templates).id === template.id);
    linkedConditions.forEach(condition => conditionToModule.set(condition.id, template.id));
    const linkedConditionIds = linkedConditions.map(condition => condition.id);
    const linkedCalculations = input.calculations.filter(calculation => calculation.conditionId ? linkedConditionIds.includes(calculation.conditionId) : bestModuleForText(calculation.title, templates).id === template.id);
    const linkedSources = input.sources.filter(source => source.conditionId ? linkedConditionIds.includes(source.conditionId) : bestModuleForText(source.title, templates).id === template.id);
    return {
      ...withoutKeywords(template),
      feasibilityScore: moduleFeasibility(template, linkedConditions, input),
      linkedConditionIds,
      linkedCalculationIds: linkedCalculations.map(item => item.id),
      linkedSourceIds: linkedSources.map(item => item.id),
    };
  });

  const researchOverlays = buildResearchOverlays(input, templates, conditionToModule);
  const geometryPlan = buildGeometryPlan(artifactClass, corpus, physicalModules);
  const progress = normalizePercent(input.analysis?.researchProgress);
  const functionality = normalizePercent(input.analysis?.functionalityProgress);
  const testability = normalizePercent(input.analysis?.testabilityProgress);
  const confidence = normalizePercent(input.analysis?.confidence);
  const averageFeasibility = Math.round(physicalModules.reduce((sum, module) => sum + module.feasibilityScore, 0) / physicalModules.length);
  const largestGap = largestGapOrders(input.calculations);

  return engineeringModelSchema.parse({
    materiality,
    artifactClass,
    artifactLabel: artifactClassLabel(artifactClass, ru),
    artifactName: input.hypothesis.title.trim() || artifactClassLabel(artifactClass, ru),
    summary: input.analysis?.summary?.trim() || (ru
      ? 'Физическая инженерная архитектура отделена от исследовательских ограничений и проверочных задач.'
      : 'Physical engineering architecture is separated from research constraints and validation tasks.'),
    engineeringIntent: input.analysis?.formalizedClaim?.trim() || input.hypothesis.text.trim(),
    physicalModules,
    researchOverlays,
    geometryPlan,
    interfaces: buildInterfaces(physicalModules),
    metrics: [
      metric('research', ru ? 'Исследование' : 'Research', progress),
      metric('functionality', ru ? 'Работоспособность' : 'Functionality', functionality),
      metric('testability', ru ? 'Проверяемость' : 'Testability', testability),
      metric('confidence', ru ? 'Уверенность' : 'Confidence', confidence),
      metric('module-feasibility', ru ? 'Готовность физических модулей' : 'Physical module feasibility', averageFeasibility),
    ],
    charts: [
      {id: 'physical-feasibility', title: ru ? 'Готовность физических модулей' : 'Physical module feasibility', type: 'feasibility', data: physicalModules.map(module => ({label: module.name, value: module.feasibilityScore}))},
      {id: 'overlay-load', title: ru ? 'Нагрузка исследовательских ограничений' : 'Research overlay load', type: 'testability', data: physicalModules.map(module => ({label: module.name, value: researchOverlays.filter(overlay => overlay.linkedModuleId === module.id).length}))},
      ...(largestGap === null ? [] : [{id: 'largest-gap', title: ru ? 'Главный численный разрыв' : 'Largest numerical gap', type: 'energy_gap' as const, data: [{label: ru ? 'Разрыв' : 'Gap', value: largestGap}]}]),
    ],
    nextEngineeringStep: nextStep(physicalModules, researchOverlays, materiality, ru),
  });
}

export function enrichEngineeringModelContext(model: CanonicalEngineeringModel, input: EngineeringSynthesisInput): CanonicalEngineeringModel {
  const fallback = synthesizeEngineeringModelFallback(input);
  const existingModuleIds = new Set(model.physicalModules.map(module => module.id));
  const physicalModules = model.physicalModules.map(module => {
    const latest = fallback.physicalModules.find(item => item.id === module.id || item.category === module.category);
    return latest
      ? {
        ...module,
        linkedConditionIds: uniqueStrings([...module.linkedConditionIds, ...latest.linkedConditionIds]),
        linkedCalculationIds: uniqueStrings([...module.linkedCalculationIds, ...latest.linkedCalculationIds]),
        linkedSourceIds: uniqueStrings([...module.linkedSourceIds, ...latest.linkedSourceIds]),
      }
      : module;
  });
  const missingModules = fallback.physicalModules.filter(module => !existingModuleIds.has(module.id) && !physicalModules.some(item => item.category === module.category));
  const moduleIds = new Set([...physicalModules, ...missingModules].map(module => module.id));
  const researchOverlays = uniqueOverlays([...model.researchOverlays, ...fallback.researchOverlays]).filter(overlay => moduleIds.has(overlay.linkedModuleId));
  const geometryPlan = mergeGeometryPlans(model.geometryPlan, fallback.geometryPlan, moduleIds);
  return engineeringModelSchema.parse({
    ...model,
    artifactLabel: model.artifactLabel || fallback.artifactLabel,
    physicalModules: [...physicalModules, ...missingModules],
    researchOverlays,
    geometryPlan,
    interfaces: buildInterfaces([...physicalModules, ...missingModules]),
    charts: fallback.charts,
  });
}

function normalizeModel(model: CanonicalEngineeringModel, input: EngineeringSynthesisInput): CanonicalEngineeringModel {
  const fallback = synthesizeEngineeringModelFallback(input);
  const safeModel = engineeringModelSchema.parse({
    ...model,
    artifactLabel: model.artifactLabel || artifactClassLabel(model.artifactClass, isRussian(input.locale)),
    physicalModules: model.physicalModules.length ? model.physicalModules : fallback.physicalModules,
    researchOverlays: model.researchOverlays,
    geometryPlan: model.geometryPlan?.primitives?.length ? model.geometryPlan : fallback.geometryPlan,
  });
  return enrichEngineeringModelContext(safeModel, input);
}

function buildPhysicalArchitecture(artifactClass: CanonicalEngineeringModel['artifactClass'], corpus: string, ru: boolean): ModuleTemplate[] {
  if (artifactClass === 'vehicle') return vehicleModules(ru);
  if (artifactClass === 'wearable') return wearableModules(ru, /jet|reactive|ранец|реактив/i.test(corpus));
  if (artifactClass === 'battery') return batteryModules(ru);
  if (artifactClass === 'material_system') return materialModules(ru);
  if (artifactClass === 'propulsion') return propulsionModules(ru);
  if (artifactClass === 'reactor') return reactorModules(ru);
  if (artifactClass === 'sensor') return sensorModules(ru);
  return genericModules(ru);
}

function vehicleModules(ru: boolean): ModuleTemplate[] {
  return [
    module('body', ru ? 'Несущий корпус' : 'Load-bearing body', ru ? 'Основная структура летающего аппарата, воспринимающая аэродинамические и посадочные нагрузки.' : 'Primary vehicle structure that carries aerodynamic and landing loads.', 'body', 'body', 'center', ['body', 'frame', 'structure', 'корпус', 'каркас']),
    module('cabin', ru ? 'Кабина' : 'Cabin', ru ? 'Защищённый объём для пилота, полезной нагрузки и интерфейсов управления.' : 'Protected volume for pilot, payload, and control interfaces.', 'cabin', 'cabin', 'front', ['cabin', 'cockpit', 'pilot', 'кабин', 'пилот']),
    module('lift-system', ru ? 'Подъёмная система' : 'Lift system', ru ? 'Крылья, роторы или вентиляторы, создающие подъёмную силу.' : 'Wings, rotors, or fans that generate lift.', 'lift', 'rotor', 'top', ['lift', 'wing', 'rotor', 'hover', 'подъ', 'крыл', 'ротор']),
    module('propulsion-modules', ru ? 'Тяговые модули' : 'Propulsion modules', ru ? 'Движители для горизонтальной тяги, манёвра и стабилизации.' : 'Propulsors for forward thrust, maneuvering, and stabilization.', 'propulsion', 'thruster', 'rear', ['thrust', 'propulsion', 'engine', 'тяга', 'двигател']),
    module('energy-module', ru ? 'Энергетический модуль' : 'Energy module', ru ? 'Источник энергии и силовая распределительная шина аппарата.' : 'Energy source and power distribution bus.', 'energy', 'battery_pack', 'internal', ['energy', 'power', 'battery', 'fuel', 'энерг', 'аккумулятор']),
    module('control-system', ru ? 'Контур управления' : 'Control system', ru ? 'Навигация, стабилизация, обратная связь и исполнительное управление.' : 'Navigation, stabilization, feedback, and actuator control.', 'control', 'control_core', 'front', ['control', 'navigation', 'stability', 'управлен', 'навигац', 'стабил']),
    module('safety-system', ru ? 'Система безопасности' : 'Safety system', ru ? 'Резервирование, аварийная посадка и защита пассажира.' : 'Redundancy, emergency landing, and passenger protection.', 'safety', 'shield', 'external', ['safety', 'redundancy', 'fail', 'безопас', 'отказ']),
    module('thermal-system', ru ? 'Тепловой контур' : 'Thermal system', ru ? 'Отвод тепла от двигателей, батарей и силовой электроники.' : 'Heat rejection from engines, batteries, and power electronics.', 'thermal', 'heat_sink', 'bottom', ['heat', 'thermal', 'cool', 'тепл', 'охлаж']),
  ];
}

function wearableModules(ru: boolean, jetpack: boolean): ModuleTemplate[] {
  return [
    module('helmet', ru ? 'Шлем' : 'Helmet', ru ? 'Защита головы, обзор, связь и сенсорный интерфейс.' : 'Head protection, vision, communications, and sensor interface.', 'sensor', 'sensor_array', 'top', ['helmet', 'sensor', 'vision', 'шлем', 'визор', 'датчик']),
    module('torso', ru ? 'Торс' : 'Torso', ru ? 'Центральная несущая часть костюма и интерфейс крепления модулей.' : 'Central load-bearing suit section and module mounting interface.', 'body', 'body', 'center', ['torso', 'body', 'frame', 'торс', 'корпус']),
    module('arms', ru ? 'Руки' : 'Arms', ru ? 'Приводы плеч, локтей и кистей для передачи усилия.' : 'Shoulder, elbow, and wrist actuators for force transfer.', 'body', 'frame', 'left', ['arm', 'actuator', 'force', 'рук', 'привод']),
    module('legs', ru ? 'Ноги' : 'Legs', ru ? 'Опорные приводы, шаг, баланс и передача нагрузки на поверхность.' : 'Support actuators, gait, balance, and load transfer to the ground.', 'body', 'frame', 'bottom', ['leg', 'balance', 'ног', 'баланс']),
    module('power-core', ru ? 'Энергетическое ядро' : 'Power core', ru ? 'Компактный источник энергии и силовая шина костюма.' : 'Compact energy source and suit power bus.', 'energy', 'battery_pack', 'internal', ['power', 'energy', 'core', 'энерг', 'ядро']),
    module('thrusters', jetpack ? (ru ? 'Реактивные сопла' : 'Jet nozzles') : (ru ? 'Реактивные сопла' : 'Thrusters'), ru ? 'Тяговые сопла для маневрирования или полёта.' : 'Thrust nozzles for maneuvering or flight.', 'propulsion', 'thruster', 'rear', ['thruster', 'jet', 'flight', 'сопл', 'тяга', 'полёт']),
    module('armor', ru ? 'Броня' : 'Armor', ru ? 'Защитная оболочка, распределяющая ударные и тепловые нагрузки.' : 'Protective shell that distributes impact and thermal loads.', 'safety', 'shield', 'external', ['armor', 'shield', 'брон', 'защит']),
    module('cooling', ru ? 'Охлаждение' : 'Cooling', ru ? 'Тепловой контур для силовых приводов, батарей и пилота.' : 'Thermal circuit for actuators, batteries, and operator.', 'thermal', 'heat_sink', 'bottom', ['cooling', 'thermal', 'heat', 'охлаж', 'тепл']),
    module('stabilization', ru ? 'Стабилизация' : 'Stabilization', ru ? 'Контур управления равновесием, положением и безопасным движением.' : 'Control loop for balance, attitude, and safe movement.', 'control', 'control_core', 'front', ['stability', 'control', 'feedback', 'стабил', 'управлен']),
  ];
}

function batteryModules(ru: boolean): ModuleTemplate[] {
  return [
    module('casing', ru ? 'Корпус' : 'Casing', ru ? 'Механическая защита и изоляция батарейного пакета.' : 'Mechanical protection and insulation for the battery pack.', 'body', 'body', 'center', ['case', 'casing', 'корпус']),
    module('cells', ru ? 'Ячейки' : 'Cells', ru ? 'Стек электрохимических ячеек, определяющий ёмкость и мощность.' : 'Electrochemical cell stack defining capacity and power.', 'energy', 'cell_stack', 'internal', ['cell', 'ячейк']),
    module('anode', ru ? 'Анод' : 'Anode', ru ? 'Литиевый или иной активный отрицательный электрод.' : 'Lithium or other active negative electrode.', 'material', 'frame', 'left', ['anode', 'литий', 'анод']),
    module('air-cathode', ru ? 'Воздушный катод' : 'Air cathode', ru ? 'Катодный узел, принимающий кислород из воздушного потока.' : 'Cathode assembly that accepts oxygen from airflow.', 'material', 'frame', 'right', ['cathode', 'oxygen', 'катод', 'кислород']),
    module('air-filter', ru ? 'Фильтр воздуха' : 'Air filter', ru ? 'Мембрана или фильтр, ограничивающий воду, CO2 и загрязнения.' : 'Membrane or filter that rejects water, CO2, and contaminants.', 'safety', 'shield', 'front', ['filter', 'membrane', 'air', 'фильтр', 'мембран', 'воздух']),
    module('electrolyte', ru ? 'Электролит' : 'Electrolyte', ru ? 'Ионопроводящая среда с требованиями к стабильности и потерям.' : 'Ion-conducting medium with stability and loss constraints.', 'material', 'generic', 'internal', ['electrolyte', 'ion', 'электролит', 'ион']),
    module('terminals', ru ? 'Контакты' : 'Terminals', ru ? 'Токосъём, силовые клеммы и внешнее подключение.' : 'Current collection, power terminals, and external connection.', 'control', 'control_core', 'top', ['terminal', 'contact', 'контакт', 'клемм']),
    module('thermal-loop', ru ? 'Тепловой контур' : 'Thermal loop', ru ? 'Отвод тепла и контроль безопасной температуры пакета.' : 'Heat rejection and safe pack temperature control.', 'thermal', 'heat_sink', 'bottom', ['thermal', 'heat', 'cool', 'тепл', 'охлаж']),
  ];
}

function materialModules(ru: boolean): ModuleTemplate[] {
  return [
    module('material-core', ru ? 'Материальная матрица' : 'Material matrix', ru ? 'Основная фаза или матрица, несущая целевое физическое свойство.' : 'Primary phase or matrix carrying the target physical property.', 'material', 'frame', 'center', ['material', 'matrix', 'phase', 'материал', 'матриц', 'фаз']),
    module('microstructure', ru ? 'Микроструктура' : 'Microstructure', ru ? 'Архитектура зёрен, слоёв, волокон или доменов.' : 'Architecture of grains, layers, fibers, or domains.', 'material', 'cell_stack', 'internal', ['microstructure', 'grain', 'layer', 'микроструктур', 'слой']),
    module('interface-layer', ru ? 'Интерфейсный слой' : 'Interface layer', ru ? 'Границы фаз, контакты и дефектные области, управляющие свойствами.' : 'Phase boundaries, contacts, and defect regions governing properties.', 'body', 'frame', 'external', ['interface', 'boundary', 'defect', 'границ', 'дефект']),
    module('measurement-rig', ru ? 'Измерительный контур' : 'Measurement rig', ru ? 'Контур проверки прочности, сопротивления, отклика или критического параметра.' : 'Rig for measuring strength, resistance, response, or critical parameters.', 'measurement', 'sensor_array', 'front', ['measure', 'test', 'измер', 'испыт']),
    module('thermal-control', ru ? 'Температурный контур' : 'Temperature control', ru ? 'Контроль температуры и тепловых градиентов при проверке материала.' : 'Temperature and thermal-gradient control during material validation.', 'thermal', 'heat_sink', 'bottom', ['thermal', 'temperature', 'температур', 'тепл']),
    module('safety-envelope', ru ? 'Контур безопасности' : 'Safety envelope', ru ? 'Ограничение разрушения, токсичности, давления или электрических рисков.' : 'Containment for fracture, toxicity, pressure, or electrical risks.', 'safety', 'shield', 'external', ['safety', 'contain', 'безопас', 'защит']),
  ];
}

function propulsionModules(ru: boolean): ModuleTemplate[] {
  return [
    module('housing', ru ? 'Корпус двигателя' : 'Engine housing', ru ? 'Несущая оболочка тяговой системы.' : 'Load-bearing shell of the thrust system.', 'body', 'body', 'center', ['housing', 'frame', 'корпус']),
    module('energy-feed', ru ? 'Энергопитание' : 'Energy feed', ru ? 'Топливо, батарея или иной поток энергии.' : 'Fuel, battery, or another energy flow.', 'energy', 'battery_pack', 'rear', ['energy', 'fuel', 'энерг', 'топлив']),
    module('thrust-chamber', ru ? 'Тяговая камера' : 'Thrust chamber', ru ? 'Область формирования импульса или реактивной струи.' : 'Region where impulse or jet flow is generated.', 'propulsion', 'thruster', 'center', ['thrust', 'chamber', 'тяга', 'камера']),
    module('nozzle', ru ? 'Сопло' : 'Nozzle', ru ? 'Геометрия преобразования давления или потока в тягу.' : 'Geometry converting pressure or flow into thrust.', 'propulsion', 'thruster', 'front', ['nozzle', 'сопло']),
    module('control-system', ru ? 'Контур управления' : 'Control system', ru ? 'Стабилизация тяги, направления и аварийных режимов.' : 'Thrust, direction, and emergency-mode stabilization.', 'control', 'control_core', 'external', ['control', 'stability', 'управлен']),
    module('thermal-system', ru ? 'Тепловой контур' : 'Thermal system', ru ? 'Отвод тепла и защита материалов от перегрева.' : 'Heat rejection and material overtemperature protection.', 'thermal', 'heat_sink', 'bottom', ['thermal', 'heat', 'тепл']),
  ];
}

function reactorModules(ru: boolean): ModuleTemplate[] {
  return [
    module('reactor-vessel', ru ? 'Корпус реактора' : 'Reactor vessel', ru ? 'Защитный корпус активной зоны.' : 'Protective housing for the active zone.', 'body', 'body', 'center', ['vessel', 'reactor', 'корпус', 'реактор']),
    module('active-core', ru ? 'Активная зона' : 'Active core', ru ? 'Область целевого физического процесса.' : 'Region of the target physical process.', 'energy', 'control_core', 'internal', ['core', 'active', 'ядро', 'зона']),
    module('thermal-loop', ru ? 'Тепловой контур' : 'Thermal loop', ru ? 'Отвод и измерение тепловой нагрузки.' : 'Heat removal and thermal-load measurement.', 'thermal', 'heat_sink', 'external', ['heat', 'thermal', 'тепл']),
    module('control-system', ru ? 'Контур управления' : 'Control system', ru ? 'Управление режимами, обратная связь и аварийная остановка.' : 'Mode control, feedback, and shutdown handling.', 'control', 'control_core', 'front', ['control', 'управлен']),
    module('shielding', ru ? 'Защита' : 'Shielding', ru ? 'Физическая защита от опасных потоков и отказов.' : 'Physical protection against hazardous flows and failures.', 'safety', 'shield', 'external', ['shield', 'safety', 'защит']),
  ];
}

function sensorModules(ru: boolean): ModuleTemplate[] {
  return [
    module('sensor-array', ru ? 'Сенсорная матрица' : 'Sensor array', ru ? 'Физический чувствительный элемент или массив элементов.' : 'Physical sensing element or array.', 'sensor', 'sensor_array', 'center', ['sensor', 'detector', 'датчик']),
    module('signal-chain', ru ? 'Сигнальный тракт' : 'Signal chain', ru ? 'Усиление, фильтрация и цифровая обработка сигнала.' : 'Amplification, filtering, and digital signal processing.', 'control', 'control_core', 'rear', ['signal', 'filter', 'сигнал']),
    module('power-module', ru ? 'Питание' : 'Power module', ru ? 'Энергия для сенсора и электроники.' : 'Power for sensor and electronics.', 'energy', 'battery_pack', 'bottom', ['power', 'energy', 'пит', 'энерг']),
    module('calibration-rig', ru ? 'Калибровочный контур' : 'Calibration rig', ru ? 'Эталон, контроль и проверка чувствительности.' : 'Reference, control, and sensitivity validation.', 'measurement', 'sensor_array', 'front', ['calibration', 'measure', 'калибр', 'измер']),
  ];
}

function genericModules(ru: boolean): ModuleTemplate[] {
  return [
    module('body', ru ? 'Несущая структура' : 'Load-bearing structure', ru ? 'Физическая рама или корпус, который удерживает остальные модули и передаёт нагрузки.' : 'Physical frame or housing that carries the other modules and transfers loads.', 'body', 'body', 'center', ['body', 'system', 'structure', 'frame', 'housing', 'корпус', 'рама', 'каркас', 'структур']),
    module('functional-core', ru ? 'Функциональное ядро' : 'Functional core', ru ? 'Физическая зона, где должен возникать основной проверяемый эффект.' : 'Physical region where the main testable effect should occur.', 'material', 'generic', 'internal', ['core', 'effect', 'active', 'process', 'ядро', 'эффект', 'актив', 'процесс']),
    module('energy-interface', ru ? 'Энергетический интерфейс' : 'Energy interface', ru ? 'Источник энергии, входное воздействие или силовой ввод для работы устройства.' : 'Energy source, input stimulus, or power interface for operating the device.', 'energy', 'battery_pack', 'rear', ['energy', 'power', 'field', 'charge', 'энерг', 'питание', 'поле', 'заряд']),
    module('actuation-or-force-path', ru ? 'Силовой или исполнительный тракт' : 'Actuation or force path', ru ? 'Модуль, который создаёт движение, поток, силу, раскрытие или другое физическое действие.' : 'Module that creates motion, flow, force, deployment, or another physical action.', 'propulsion', 'thruster', 'external', ['force', 'motion', 'actuator', 'drive', 'flow', 'move', 'сила', 'движ', 'привод', 'поток', 'перемещ']),
    module('control-system', ru ? 'Контур управления' : 'Control system', ru ? 'Управление режимами, обратной связью, устойчивостью и аварийным отключением.' : 'Control of modes, feedback, stability, and safe shutdown.', 'control', 'control_core', 'front', ['control', 'logic', 'feedback', 'stability', 'управлен', 'логик', 'обрат', 'стабил']),
    module('sensor-measurement', ru ? 'Сенсоры и измерения' : 'Sensors and measurement', ru ? 'Измерение целевого эффекта, нагрузок, состояния среды и контрольных параметров.' : 'Measurement of the target effect, loads, environment state, and control parameters.', 'measurement', 'sensor_array', 'external', ['sensor', 'measure', 'detect', 'signal', 'датчик', 'измер', 'сигнал', 'детект']),
    module('thermal-path', ru ? 'Тепловой путь' : 'Thermal path', ru ? 'Отвод, накопление или ограничение тепла, возникающего при работе системы.' : 'Heat rejection, storage, or limitation during system operation.', 'thermal', 'heat_sink', 'bottom', ['thermal', 'heat', 'cool', 'temperature', 'тепл', 'охлаж', 'температур']),
    module('safety-envelope', ru ? 'Контур безопасности' : 'Safety envelope', ru ? 'Защитный слой, резервирование и ограничение опасных отказов.' : 'Protective layer, redundancy, and containment of hazardous failures.', 'safety', 'shield', 'external', ['safety', 'protect', 'contain', 'risk', 'безопас', 'защит', 'риск', 'отказ']),
  ];
}

function module(
  id: string,
  name: string,
  role: string,
  category: EngineeringPhysicalCategory,
  geometryHint: EngineeringPhysicalGeometryHint,
  positionHint: EngineeringPositionHint,
  keywords: string[],
): ModuleTemplate {
  return {id, name, role, category, geometryHint, positionHint, keywords};
}

function buildResearchOverlays(input: EngineeringSynthesisInput, modules: ModuleTemplate[], conditionToModule: Map<string, string>): CanonicalEngineeringResearchOverlay[] {
  const overlays: CanonicalEngineeringResearchOverlay[] = [];
  for (const condition of input.conditions) {
    const linkedModuleId = conditionToModule.get(condition.id) ?? bestModuleForText(`${condition.title} ${condition.description ?? ''}`, modules).id;
    overlays.push({
      id: `blocker-${condition.id}`,
      linkedModuleId,
      type: 'blocker',
      title: condition.title,
      severity: conditionSeverity(condition),
    });
  }
  for (const calculation of input.calculations) {
    const linkedModuleId = calculation.conditionId ? conditionToModule.get(calculation.conditionId) ?? bestModuleForText(calculation.title, modules).id : bestModuleForText(calculation.title, modules).id;
    const gapOrders = largestGapOrders([calculation]);
    overlays.push({
      id: `calculation-${calculation.id}`,
      linkedModuleId,
      type: 'calculation',
      title: calculation.title,
      severity: gapOrders !== null && gapOrders >= 6 ? 'critical' : gapOrders !== null && gapOrders >= 3 ? 'warning' : 'info',
      ...(gapOrders === null ? {} : {gapOrders}),
    });
  }
  for (const source of input.sources) {
    const linkedModuleId = source.conditionId ? conditionToModule.get(source.conditionId) ?? bestModuleForText(source.title, modules).id : bestModuleForText(source.title, modules).id;
    overlays.push({id: `source-${source.id}`, linkedModuleId, type: 'source', title: source.title, severity: 'info'});
  }
  for (const experiment of input.experiments ?? []) {
    const linkedModuleId = experiment.conditionId ? conditionToModule.get(experiment.conditionId) ?? bestModuleForText(experiment.title, modules).id : bestModuleForText(experiment.title, modules).id;
    overlays.push({id: `experiment-${experiment.id}`, linkedModuleId, type: 'experiment', title: experiment.title, severity: 'success'});
  }
  for (const session of input.breakthroughSessions) {
    overlays.push({
      id: `breakthrough-${session.id}`,
      linkedModuleId: conditionToModule.get(session.conditionId) ?? bestModuleForText(session.title, modules).id,
      type: 'breakthrough',
      title: session.title,
      severity: normalizePercent(session.progressScore) >= 50 ? 'success' : 'warning',
    });
  }
  return uniqueOverlays(overlays);
}

function bestModuleForText(text: string, modules: ModuleTemplate[]): ModuleTemplate {
  const normalized = text.toLowerCase();
  let best = modules[0];
  let bestScore = -1;
  for (const module of modules) {
    const score = module.keywords.reduce((sum, keyword) => sum + (normalized.includes(keyword.toLowerCase()) ? 1 : 0), 0)
      + (normalized.includes(module.category) ? 1 : 0);
    if (score > bestScore) {
      best = module;
      bestScore = score;
    }
  }
  return best;
}

function withoutKeywords(template: ModuleTemplate): Omit<ModuleTemplate, 'keywords'> {
  const {keywords: _keywords, ...module} = template;
  return module;
}

function moduleFeasibility(template: ModuleTemplate, conditions: EngineeringSynthesisInput['conditions'], input: EngineeringSynthesisInput): number {
  if (conditions.length) {
    return Math.round(conditions.reduce((sum, condition) => sum + normalizePercent(condition.completionScore), 0) / conditions.length);
  }
  if (template.category === 'measurement') return normalizePercent(input.analysis?.testabilityProgress);
  if (template.category === 'control' || template.category === 'safety') return normalizePercent(input.analysis?.researchProgress);
  return normalizePercent(input.analysis?.functionalityProgress);
}

function buildInterfaces(modules: CanonicalEngineeringPhysicalModule[]): CanonicalEngineeringModel['interfaces'] {
  const byId = new Map(modules.map(module => [module.id, module]));
  const body = modules.find(module => module.category === 'body') ?? modules[0];
  const interfaces: CanonicalEngineeringModel['interfaces'] = [];
  for (const module of modules) {
    if (module.id !== body.id) interfaces.push({fromModuleId: body.id, toModuleId: module.id, type: interfaceType(body.category, module.category)});
  }
  const energy = modules.find(module => module.category === 'energy');
  for (const category of ['propulsion', 'control', 'thermal', 'sensor'] as EngineeringPhysicalCategory[]) {
    const target = modules.find(module => module.category === category);
    if (energy && target && energy.id !== target.id) interfaces.push({fromModuleId: energy.id, toModuleId: target.id, type: interfaceType(energy.category, target.category)});
  }
  const control = modules.find(module => module.category === 'control');
  for (const category of ['safety', 'propulsion', 'lift', 'sensor', 'measurement'] as EngineeringPhysicalCategory[]) {
    const target = modules.find(module => module.category === category);
    if (control && target && control.id !== target.id) interfaces.push({fromModuleId: control.id, toModuleId: target.id, type: interfaceType(control.category, target.category)});
  }
  return uniqueInterfaces(interfaces).filter(link => byId.has(link.fromModuleId) && byId.has(link.toModuleId));
}

function buildGeometryPlan(
  artifactClass: CanonicalEngineeringModel['artifactClass'],
  corpus: string,
  modules: CanonicalEngineeringPhysicalModule[],
): CanonicalEngineeringGeometryPlan {
  const primitives: CanonicalEngineeringGeometryPrimitive[] = [];
  const add = primitiveAdder(primitives);
  const moduleByCategory = (category: EngineeringPhysicalCategory) => modules.find(module => module.category === category);
  const fallbackModule = modules[0];
  const layout = inferGeometryLayout(artifactClass, corpus, modules);
  if (layout === 'humanoid') addHumanoidLayout(add, modules, fallbackModule, moduleByCategory);
  else if (layout === 'vehicle' || layout === 'winged') addVehicleLikeLayout(add, modules, fallbackModule, moduleByCategory, layout);
  else if (layout === 'layered') addLayeredLayout(add, modules, fallbackModule, moduleByCategory);
  else if (layout === 'radial' || layout === 'ring') addRadialLayout(add, modules, fallbackModule, moduleByCategory);
  else addFreeformLayout(add, modules);
  return finalizeGeometryPlan(layout, primitives, modules);
}

function inferGeometryLayout(
  artifactClass: CanonicalEngineeringModel['artifactClass'],
  corpus: string,
  modules: CanonicalEngineeringPhysicalModule[],
): CanonicalEngineeringGeometryPlan['layout'] {
  const has = (pattern: RegExp) => pattern.test(corpus);
  if (artifactClass === 'wearable' || has(/wearable|operator|body-mounted|exoskeleton|human|носим|человек|тело|экзоскелет|оператор/)) return 'humanoid';
  if (has(/round|circular|disc|radial|annular|ring|wave|blast|impact|pressure|круг|кольц|радиаль|волна|удар|давлен|импульс/)) return 'ring';
  if (artifactClass === 'battery' || artifactClass === 'material_system' || has(/layer|stack|cell|membrane|filter|material|composite|phase|laminate|сло|пакет|ячей|мембран|фильтр|материал|композит|фаза/)) return 'layered';
  if (artifactClass === 'vehicle' || has(/lift|rotor|wing|flight|thrust|transport|cargo|bridge|span|движ|тяга|подъ[её]м|ротор|крыл|пол[её]т|транспорт|груз|мост|пролет/)) return has(/curved|blade|profile|лопаст|изогнут|профиль/) ? 'winged' : 'vehicle';
  if (artifactClass === 'reactor' || artifactClass === 'propulsion' || has(/field|plasma|reactor|generator|launcher|emitter|magnetic|поле|плазм|реактор|генератор|пуск|излучател|магнит/)) return 'radial';
  return modules.length <= 4 ? 'symmetric' : 'freeform';
}

function addHumanoidLayout(
  add: ReturnType<typeof primitiveAdder>,
  modules: CanonicalEngineeringPhysicalModule[],
  fallbackModule: CanonicalEngineeringPhysicalModule,
  moduleByCategory: (category: EngineeringPhysicalCategory) => CanonicalEngineeringPhysicalModule | undefined,
) {
  const body = moduleByCategory('body') ?? moduleByCategory('material') ?? fallbackModule;
  const sensor = moduleByCategory('sensor') ?? moduleByCategory('measurement') ?? body;
  const structure = modules.find(module => module.category === 'body' && module.id !== body.id) ?? body;
  const energy = moduleByCategory('energy') ?? body;
  const propulsion = moduleByCategory('propulsion') ?? moduleByCategory('lift') ?? body;
  const safety = moduleByCategory('safety') ?? body;
  const thermal = moduleByCategory('thermal') ?? body;
  const control = moduleByCategory('control') ?? sensor;
  add(body, 'central-body-carrier', 'capsule', [0, .2, 0], [0, 0, 0], [.48, .86, .28], 'structure');
  add(sensor, 'upper-sensor-node', 'sphere', [0, 1.18, 0], [0, 0, 0], [.28, .28, .28], 'sensor');
  add(structure, 'left-support-link', 'capsule', [-.62, .22, 0], [0, 0, .18], [.16, .68, .16], 'structure');
  add(structure, 'right-support-link', 'capsule', [.62, .22, 0], [0, 0, -.18], [.16, .68, .16], 'structure');
  add(structure, 'left-ground-link', 'capsule', [-.24, -.82, 0], [0, 0, 0], [.17, .78, .17], 'structure');
  add(structure, 'right-ground-link', 'capsule', [.24, -.82, 0], [0, 0, 0], [.17, .78, .17], 'structure');
  add(energy, 'internal-energy-core', 'sphere', [0, .26, -.28], [0, 0, 0], [.2, .2, .2], 'energy');
  add(propulsion, 'force-actuator-pack', 'cylinder', [0, .02, .46], [Math.PI / 2, 0, 0], [.16, .5, .16], 'propulsion');
  add(safety, 'protective-envelope', 'panel', [0, .24, -.36], [0, 0, 0], [.58, .68, .05], 'shield', .62);
  add(thermal, 'thermal-path', 'lattice', [0, -.2, .36], [0, 0, 0], [.52, .24, .08], 'thermal');
  add(control, 'control-reference-node', 'sphere', [0, .74, -.26], [0, 0, 0], [.12, .12, .12], 'control');
}

function addVehicleLikeLayout(
  add: ReturnType<typeof primitiveAdder>,
  modules: CanonicalEngineeringPhysicalModule[],
  fallbackModule: CanonicalEngineeringPhysicalModule,
  moduleByCategory: (category: EngineeringPhysicalCategory) => CanonicalEngineeringPhysicalModule | undefined,
  layout: 'vehicle' | 'winged',
) {
  const body = moduleByCategory('body') ?? moduleByCategory('material') ?? fallbackModule;
  const cabin = moduleByCategory('cabin') ?? moduleByCategory('sensor') ?? body;
  const lift = moduleByCategory('lift') ?? moduleByCategory('propulsion') ?? body;
  const propulsion = moduleByCategory('propulsion') ?? lift;
  const energy = moduleByCategory('energy') ?? body;
  const control = moduleByCategory('control') ?? cabin;
  const safety = moduleByCategory('safety') ?? body;
  const thermal = moduleByCategory('thermal') ?? body;
  if (layout === 'winged') {
    add(body, 'left-functional-blade', 'curved_blade', [-.62, 0, 0], [0, -.48, .22], [1.2, .1, .32], 'structure');
    add(body, 'right-functional-blade', 'curved_blade', [.62, 0, 0], [0, .48, -.22], [1.2, .1, .32], 'structure');
    add(body, 'central-mass', 'sphere', [0, 0, 0], [0, 0, 0], [.28, .18, .28], 'body');
  } else {
    add(body, 'elongated-load-body', 'rounded_box', [0, 0, 0], [0, 0, 0], [1.55, .36, .72], 'body');
    add(cabin, 'forward-cockpit-or-sensor-bay', 'sphere', [0, .38, -.32], [0, 0, 0], [.42, .28, .36], 'glass', .62);
  }
  add(lift, 'left-force-ring', 'ring', [-1.18, .18, -.52], [Math.PI / 2, 0, 0], [.42, .06, .42], 'propulsion');
  add(lift, 'right-force-ring', 'ring', [1.18, .18, -.52], [Math.PI / 2, 0, 0], [.42, .06, .42], 'propulsion');
  add(propulsion, 'rear-force-channel-left', 'cylinder', [-.44, -.04, .84], [Math.PI / 2, 0, 0], [.16, .48, .16], 'propulsion');
  add(propulsion, 'rear-force-channel-right', 'cylinder', [.44, -.04, .84], [Math.PI / 2, 0, 0], [.16, .48, .16], 'propulsion');
  add(energy, 'internal-energy-pack', 'rounded_box', [0, -.28, .18], [0, 0, 0], [.62, .2, .38], 'energy');
  add(control, 'control-core', 'sphere', [0, .24, -.78], [0, 0, 0], [.14, .14, .14], 'control');
  add(safety, 'protective-front-or-envelope', 'panel', [0, .02, -.9], [0, 0, 0], [1.15, .22, .08], 'shield', .55);
  add(thermal, 'thermal-fins', 'lattice', [0, -.38, .72], [0, 0, 0], [.8, .1, .22], 'thermal');
  for (const module of modules.filter(module => !['body', 'cabin', 'lift', 'propulsion', 'energy', 'control', 'safety', 'thermal'].includes(module.category))) {
    const index = modules.indexOf(module);
    const side = index % 2 ? -1 : 1;
    add(module, `auxiliary-${module.id}`, shapeForModule(module), [side * 1.55, .15, .2 + index * .08], [0, side * .25, 0], scaleForModule(module), roleForCategory(module.category), .72);
  }
}

function addLayeredLayout(
  add: ReturnType<typeof primitiveAdder>,
  modules: CanonicalEngineeringPhysicalModule[],
  fallbackModule: CanonicalEngineeringPhysicalModule,
  moduleByCategory: (category: EngineeringPhysicalCategory) => CanonicalEngineeringPhysicalModule | undefined,
) {
  const body = moduleByCategory('body') ?? fallbackModule;
  const energy = moduleByCategory('energy') ?? moduleByCategory('material') ?? body;
  const material = moduleByCategory('material') ?? energy;
  const sensor = moduleByCategory('sensor') ?? moduleByCategory('measurement') ?? body;
  const safety = moduleByCategory('safety') ?? body;
  const control = moduleByCategory('control') ?? sensor;
  const thermal = moduleByCategory('thermal') ?? body;
  add(body, 'outer-housing', 'rounded_box', [0, 0, 0], [0, 0, 0], [1.35, .42, .7], 'body', .36);
  add(energy, 'functional-stack', 'cell_stack', [0, 0, 0], [0, 0, 0], [.9, .34, .48], roleForCategory(energy.category));
  add(material, 'active-material-layer-a', 'panel', [-.46, .04, 0], [0, 0, 0], [.08, .36, .52], 'structure');
  add(material, 'active-material-layer-b', 'panel', [.46, .04, 0], [0, 0, 0], [.08, .36, .52], 'structure');
  add(sensor, 'measurement-or-filter-interface', 'lattice', [.78, .02, 0], [0, 0, 0], [.16, .32, .5], 'sensor');
  add(safety, 'safety-boundary-layer', 'panel', [0, -.08, 0], [0, 0, 0], [1.05, .06, .62], 'shield', .48);
  add(control, 'control-terminal', 'cylinder', [0, .38, -.44], [Math.PI / 2, 0, 0], [.08, .48, .08], 'control');
  add(thermal, 'thermal-loop', 'tube', [0, -.34, 0], [0, 0, Math.PI / 2], [.08, 1.08, .08], 'thermal');
}

function addRadialLayout(
  add: ReturnType<typeof primitiveAdder>,
  modules: CanonicalEngineeringPhysicalModule[],
  fallbackModule: CanonicalEngineeringPhysicalModule,
  moduleByCategory: (category: EngineeringPhysicalCategory) => CanonicalEngineeringPhysicalModule | undefined,
) {
  const body = moduleByCategory('body') ?? moduleByCategory('safety') ?? fallbackModule;
  const material = moduleByCategory('material') ?? body;
  const energy = moduleByCategory('energy') ?? body;
  const sensor = moduleByCategory('sensor') ?? moduleByCategory('measurement') ?? body;
  const control = moduleByCategory('control') ?? sensor;
  const thermal = moduleByCategory('thermal') ?? body;
  add(body, 'radial-structure-ring', 'ring', [0, 0, 0], [Math.PI / 2, 0, 0], [1.2, .08, 1.2], roleForCategory(body.category));
  add(material, 'front-active-disc', 'disc', [0, .04, 0], [Math.PI / 2, 0, 0], [1.02, .05, 1.02], 'structure', .68);
  add(energy, 'central-energy-or-load-node', 'sphere', [0, .12, 0], [0, 0, 0], [.17, .17, .17], 'energy');
  add(control, 'control-reference-node', 'sphere', [0, .2, -.5], [0, 0, 0], [.12, .12, .12], 'control');
  add(sensor, 'measurement-node-a', 'sphere', [.82, .1, 0], [0, 0, 0], [.08, .08, .08], 'sensor');
  add(sensor, 'measurement-node-b', 'sphere', [-.82, .1, 0], [0, 0, 0], [.08, .08, .08], 'sensor');
  add(thermal, 'radial-thermal-path', 'lattice', [0, -.12, .58], [0, 0, 0], [.7, .12, .16], 'thermal');
}

function addFreeformLayout(add: ReturnType<typeof primitiveAdder>, modules: CanonicalEngineeringPhysicalModule[]) {
  const primary = modules.find(module => module.category === 'body') ?? modules.find(module => module.category === 'material') ?? modules[0];
  add(primary, 'universal-load-frame', 'rounded_box', [0, 0, 0], [0, 0, 0], [1.05, .34, .62], roleForCategory(primary.category));
  for (const [index, module] of modules.entries()) {
    if (module.id === primary.id) continue;
    const angle = index * 2.399;
    const radius = modules.length > 4 ? 1.15 : .72;
    const height = module.category === 'energy' ? -.3 : module.category === 'sensor' || module.category === 'measurement' ? .34 : index % 2 ? .16 : -.06;
    add(module, `role-${module.id}`, shapeForModule(module), [Math.cos(angle) * radius, height, Math.sin(angle) * radius], [0, angle, 0], scaleForModule(module), roleForCategory(module.category), .72);
  }
}

function primitiveAdder(primitives: CanonicalEngineeringGeometryPrimitive[]) {
  return (
    module: CanonicalEngineeringPhysicalModule,
    id: string,
    shape: CanonicalEngineeringGeometryPrimitive['shape'],
    position: Vector3Tuple,
    rotation: Vector3Tuple,
    scale: Vector3Tuple,
    materialRole: EngineeringGeometryMaterialRole,
    opacity?: number,
  ) => {
    primitives.push({id: uniquePrimitiveId(primitives, id), moduleId: module.id, shape, position, rotation, scale, materialRole, ...(opacity === undefined ? {} : {opacity})});
  };
}

function finalizeGeometryPlan(layout: CanonicalEngineeringGeometryPlan['layout'], primitives: CanonicalEngineeringGeometryPrimitive[], modules: CanonicalEngineeringPhysicalModule[]): CanonicalEngineeringGeometryPlan {
  const completed = ensureModulePrimitives(primitives, modules);
  const primary = completed[0];
  return {
    layout,
    primitives: completed,
    connectors: completed.slice(1).map(primitive => ({
      fromPrimitiveId: primary.id,
      toPrimitiveId: primitive.id,
      type: connectorType(primary.materialRole, primitive.materialRole),
    })),
  };
}

function ensureModulePrimitives(primitives: CanonicalEngineeringGeometryPrimitive[], modules: CanonicalEngineeringPhysicalModule[]): CanonicalEngineeringGeometryPrimitive[] {
  const completed = [...primitives];
  const moduleIds = new Set(completed.map(primitive => primitive.moduleId));
  for (const [index, module] of modules.entries()) {
    if (moduleIds.has(module.id)) continue;
    const angle = index * 2.399;
    const radius = 1.65;
    completed.push({
      id: uniquePrimitiveId(completed, `fallback-${module.id}`),
      moduleId: module.id,
      shape: shapeForModule(module),
      position: [Math.cos(angle) * radius, index % 2 ? .24 : -.18, Math.sin(angle) * radius],
      rotation: [0, angle, 0],
      scale: scaleForModule(module),
      materialRole: roleForCategory(module.category),
      opacity: .68,
    });
  }
  return completed;
}

function mergeGeometryPlans(
  modelPlan: CanonicalEngineeringGeometryPlan,
  fallbackPlan: CanonicalEngineeringGeometryPlan,
  moduleIds: Set<string>,
): CanonicalEngineeringGeometryPlan {
  const existingModules = new Set(modelPlan.primitives.map(primitive => primitive.moduleId));
  const primitives = [
    ...modelPlan.primitives.filter(primitive => moduleIds.has(primitive.moduleId)),
    ...fallbackPlan.primitives.filter(primitive => moduleIds.has(primitive.moduleId) && !existingModules.has(primitive.moduleId)),
  ];
  const primitiveIds = new Set(primitives.map(primitive => primitive.id));
  return {
    layout: modelPlan.layout || fallbackPlan.layout,
    primitives,
    connectors: [
      ...modelPlan.connectors,
      ...fallbackPlan.connectors,
    ].filter(connector => primitiveIds.has(connector.fromPrimitiveId) && primitiveIds.has(connector.toPrimitiveId)),
  };
}

function uniquePrimitiveId(primitives: CanonicalEngineeringGeometryPrimitive[], id: string): string {
  const safe = id.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  if (!primitives.some(primitive => primitive.id === safe)) return safe;
  let index = 2;
  while (primitives.some(primitive => primitive.id === `${safe}-${index}`)) index += 1;
  return `${safe}-${index}`;
}

function shapeForModule(module: CanonicalEngineeringPhysicalModule): CanonicalEngineeringGeometryPrimitive['shape'] {
  const map: Record<EngineeringPhysicalGeometryHint, CanonicalEngineeringGeometryPrimitive['shape']> = {
    body: 'rounded_box',
    cabin: 'sphere',
    wing: 'wing',
    rotor: 'ring',
    thruster: 'cylinder',
    battery_pack: 'cell_stack',
    control_core: 'sphere',
    heat_sink: 'lattice',
    sensor_array: 'sphere',
    shield: 'disc',
    frame: 'lattice',
    cell_stack: 'cell_stack',
    generic: 'rounded_box',
  };
  return map[module.geometryHint];
}

function scaleForModule(module: CanonicalEngineeringPhysicalModule): Vector3Tuple {
  const map: Record<EngineeringPhysicalGeometryHint, Vector3Tuple> = {
    body: [1, .38, .58],
    cabin: [.38, .28, .34],
    wing: [1.3, .07, .28],
    rotor: [.48, .06, .48],
    thruster: [.18, .5, .18],
    battery_pack: [.62, .22, .36],
    control_core: [.16, .16, .16],
    heat_sink: [.55, .12, .24],
    sensor_array: [.16, .16, .16],
    shield: [.8, .08, .8],
    frame: [.9, .16, .5],
    cell_stack: [.58, .34, .42],
    generic: [.48, .36, .42],
  };
  return map[module.geometryHint];
}

function roleForCategory(category: EngineeringPhysicalCategory): EngineeringGeometryMaterialRole {
  if (category === 'energy') return 'energy';
  if (category === 'thermal') return 'thermal';
  if (category === 'control') return 'control';
  if (category === 'propulsion' || category === 'lift') return 'propulsion';
  if (category === 'sensor' || category === 'measurement') return 'sensor';
  if (category === 'safety') return 'shield';
  if (category === 'body' || category === 'cabin') return 'body';
  if (category === 'material') return 'structure';
  return 'unknown';
}

function connectorType(from: EngineeringGeometryMaterialRole, to: EngineeringGeometryMaterialRole): CanonicalEngineeringGeometryPlan['connectors'][number]['type'] {
  if (from === 'energy' || to === 'energy') return 'energy';
  if (from === 'control' || to === 'control' || from === 'sensor' || to === 'sensor') return 'signal';
  if (from === 'thermal' || to === 'thermal') return 'heat';
  if (from === 'propulsion' || to === 'propulsion') return 'force';
  return 'structural';
}

function compactInput(input: EngineeringSynthesisInput) {
  return {
    locale: isRussian(input.locale) ? 'ru' : 'en',
    hypothesis: input.hypothesis,
    analysis: input.analysis,
    conditions: input.conditions.slice(0, 16),
    calculations: input.calculations.slice(0, 12),
    sources: input.sources.slice(0, 12),
    experiments: input.experiments?.slice(0, 12) ?? [],
    breakthroughSessions: input.breakthroughSessions.slice(0, 10),
  };
}

function normalizedCorpus(input: EngineeringSynthesisInput): string {
  return [input.hypothesis.title, input.hypothesis.text, input.analysis?.summary, input.analysis?.formalizedClaim, input.analysis?.knownScience, ...input.conditions.flatMap(item => [item.title, item.description])].filter(Boolean).join(' ').toLowerCase();
}

function detectMateriality(text: string): CanonicalEngineeringModel['materiality'] {
  const physical = /(device|system|machine|vehicle|bridge|structure|generator|filter|protection|cargo|air|field|force|material|energy|power|temperature|mass|sensor|reactor|battery|engine|систем|мост|конструкц|генератор|фильтр|защит|груз|воздух|поле|сила|костюм|машин|устройств|материал|энерг|температур|масса|датчик|реактор|батар|двигател|сверхпровод)/.test(text);
  const abstract = /(algorithm|theorem|logic|consciousness|ethic|social|mathematical proof|алгоритм|теорем|логик|сознани|этик|социальн|доказательств)/.test(text);
  return physical && abstract ? 'hybrid' : physical ? 'material' : abstract ? 'abstract' : 'hybrid';
}

function detectArtifactClass(text: string, materiality: CanonicalEngineeringModel['materiality']): CanonicalEngineeringModel['artifactClass'] {
  if (materiality === 'abstract') return 'unknown';
  if (/(vehicle|car|drone|aircraft|автомобил|машин|дрон|транспорт|летающ)/.test(text)) return 'vehicle';
  if (/(wearable|suit|armor|exoskeleton|jetpack|костюм|брон|экзоскелет|ранец)/.test(text)) return 'wearable';
  if (/(battery|cell|lithium|аккумулятор|батар|литий)/.test(text)) return 'battery';
  if (/(reactor|fusion|fission|реактор|синтез)/.test(text)) return 'reactor';
  if (/(propulsion|engine|thrust|jet|двигател|тяга|реактив)/.test(text)) return 'propulsion';
  if (/(material|alloy|composite|superconduct|материал|сплав|композит|сверхпровод)/.test(text)) return 'material_system';
  if (/(sensor|detector|measurement device|датчик|детектор|измерител)/.test(text)) return 'sensor';
  if (/(infrastructure|plant|network|facility|инфраструктур|станци|комплекс)/.test(text)) return 'infrastructure';
  return 'device';
}

function artifactClassLabel(artifactClass: CanonicalEngineeringModel['artifactClass'], ru: boolean): string {
  const labels = ru
    ? {device: 'Устройство', vehicle: 'Летающий транспорт', wearable: 'Костюм', battery: 'Батарея', reactor: 'Реактор', propulsion: 'Двигательная система', sensor: 'Сенсор', material_system: 'Материальная система', infrastructure: 'Инфраструктура', unknown: 'Инженерная модель'}
    : {device: 'Device', vehicle: 'Flying vehicle', wearable: 'Suit', battery: 'Battery', reactor: 'Reactor', propulsion: 'Propulsion system', sensor: 'Sensor', material_system: 'Material system', infrastructure: 'Infrastructure', unknown: 'Engineering model'};
  return labels[artifactClass];
}

function conditionSeverity(condition: EngineeringSynthesisInput['conditions'][number]): EngineeringSeverity {
  const importance = condition.importance?.toUpperCase();
  const status = condition.status?.toUpperCase() ?? '';
  if (importance === 'CRITICAL' || /CONFLICT|BREAKTHROUGH|BLOCKED/.test(status)) return 'critical';
  if (importance === 'HIGH') return 'warning';
  if (normalizePercent(condition.completionScore) >= 70) return 'success';
  return 'info';
}

function nextStep(modules: CanonicalEngineeringPhysicalModule[], overlays: CanonicalEngineeringResearchOverlay[], materiality: CanonicalEngineeringModel['materiality'], ru: boolean): string {
  if (materiality === 'abstract') return ru ? 'Сначала определить измеримый физический носитель, затем строить аппаратную архитектуру.' : 'First define a measurable physical carrier, then build the hardware architecture.';
  const mostLoaded = [...modules].sort((a, b) =>
    overlays.filter(item => item.linkedModuleId === b.id && item.severity === 'critical').length
    - overlays.filter(item => item.linkedModuleId === a.id && item.severity === 'critical').length
    || a.feasibilityScore - b.feasibilityScore
  )[0];
  return ru ? `Свести главный эксперимент к физическому модулю «${mostLoaded.name}» и измерить его предельный параметр.` : `Reduce the next experiment to the physical module “${mostLoaded.name}” and measure its limiting parameter.`;
}

function metric(id: string, label: string, value: number) {
  return {id, label, value, unit: '%', status: value >= 65 ? 'ok' as const : value >= 35 ? 'warning' as const : 'critical' as const};
}

function interfaceType(from: EngineeringPhysicalCategory, to: EngineeringPhysicalCategory): CanonicalEngineeringModel['interfaces'][number]['type'] {
  if (from === 'energy' || to === 'energy') return 'energy';
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

function normalizePercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value <= 1 ? value * 100 : value)));
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value * 10) / 10) : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueOverlays(overlays: CanonicalEngineeringResearchOverlay[]): CanonicalEngineeringResearchOverlay[] {
  return [...new Map(overlays.map(overlay => [overlay.id, overlay])).values()];
}

function uniqueInterfaces(interfaces: CanonicalEngineeringModel['interfaces']): CanonicalEngineeringModel['interfaces'] {
  return [...new Map(interfaces.map(item => [`${item.fromModuleId}:${item.toModuleId}:${item.type}`, item])).values()];
}

function isRussian(locale: string | null | undefined): boolean {
  return locale?.toLowerCase() === 'ru';
}
