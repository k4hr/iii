export type EngineeringArtifactType = 'flying_vehicle' | 'wearable_suit' | 'battery' | 'propulsion_system' | 'generic_device';
export type EngineeringSeverity = 'info' | 'success' | 'warning' | 'critical';
export type EngineeringGeometry = 'box' | 'cylinder' | 'sphere' | 'torus';
export type Vector3Tuple = [number, number, number];

export type EngineeringConditionInput = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  importance: string;
  completionScore: number;
  blockers?: unknown;
  href?: string;
};

export type EngineeringCalculationInput = {
  id: string;
  conditionId?: string | null;
  title: string;
  gapOrders?: number | null;
  gapLevel?: string | null;
  href?: string;
};

export type EngineeringSourceInput = {
  id: string;
  conditionId?: string | null;
  title: string;
  relationship: string;
  href?: string;
};

export type EngineeringBreakthroughInput = {
  id: string;
  conditionId: string;
  title: string;
  progressScore: number;
  href?: string;
};

export type EngineeringModule = {
  id: string;
  key: string;
  label: string;
  description: string;
  geometry: EngineeringGeometry;
  position: Vector3Tuple;
  explodedPosition: Vector3Tuple;
  scale: Vector3Tuple;
  color: string;
  severity: EngineeringSeverity;
  progress: number;
  conditionIds: string[];
  calculationIds: string[];
  sourceIds: string[];
  breakthroughIds: string[];
};

export type EngineeringMetric = {
  key: 'research' | 'functionality' | 'testability' | 'confidence' | 'evidence';
  value: number;
};

export type EngineeringModel = {
  artifactType: EngineeringArtifactType;
  artifactLabel: string;
  title: string;
  modules: EngineeringModule[];
  conditions: EngineeringConditionInput[];
  calculations: EngineeringCalculationInput[];
  sources: EngineeringSourceInput[];
  breakthroughs: EngineeringBreakthroughInput[];
  metrics: EngineeringMetric[];
  gapOrders: number | null;
  criticalCount: number;
};

export type BuildEngineeringModelInput = {
  locale: string;
  hypothesis: {
    id: string;
    title: string;
    text: string;
    researchProgress: number;
    functionalityProgress: number;
    testabilityProgress: number;
    confidence: number;
  };
  conditions: EngineeringConditionInput[];
  calculations: EngineeringCalculationInput[];
  sources: EngineeringSourceInput[];
  breakthroughSessions: EngineeringBreakthroughInput[];
};

type ModuleTemplate = Omit<EngineeringModule, 'id' | 'severity' | 'progress' | 'conditionIds' | 'calculationIds' | 'sourceIds' | 'breakthroughIds'> & {
  keywords: string[];
};

const artifactPatterns: Array<[EngineeringArtifactType, RegExp]> = [
  ['flying_vehicle', /flying\s*(?:car|vehicle)|air\s*car|vehicle|drone|flight|летающ(?:ая|ий|ее)\s+машин|автомобил|машин|дрон|пол[её]т/i],
  ['wearable_suit', /iron\s*man|suit|armor|armour|exoskeleton|костюм|броня/i],
  ['battery', /battery|lithium|energy|батарея|аккумулятор/i],
  ['propulsion_system', /thrust|flight|engine|propulsion|двигатель|тяга|пол[её]т/i],
];

export function detectEngineeringArtifact(text: string): EngineeringArtifactType {
  return artifactPatterns.find(([, pattern]) => pattern.test(text))?.[0] ?? 'generic_device';
}

export function buildEngineeringModel(input: BuildEngineeringModelInput): EngineeringModel {
  const ru = input.locale === 'ru';
  const artifactType = detectEngineeringArtifact(`${input.hypothesis.title} ${input.hypothesis.text}`);
  const templates = moduleTemplates(artifactType, ru);
  const conditionBuckets = new Map(templates.map(template => [template.key, [] as EngineeringConditionInput[]]));

  input.conditions.slice(0, 16).forEach((condition, index) => {
    const template = selectTemplate(templates, `${condition.title} ${condition.description ?? ''}`, index);
    conditionBuckets.get(template.key)?.push(condition);
  });

  const modules = templates.map((template, index): EngineeringModule => {
    const linkedConditions = conditionBuckets.get(template.key) ?? [];
    const conditionIds = linkedConditions.map(condition => condition.id);
    const linkedCalculations = input.calculations.filter(item => item.conditionId ? conditionIds.includes(item.conditionId) : index === 1);
    const linkedSources = input.sources.filter(item => item.conditionId ? conditionIds.includes(item.conditionId) : index === 0);
    const linkedBreakthroughs = input.breakthroughSessions.filter(item => conditionIds.includes(item.conditionId));
    const fallbackProgress = [input.hypothesis.researchProgress, input.hypothesis.functionalityProgress, input.hypothesis.testabilityProgress][index % 3];

    return {
      ...template,
      id: `engineering-module:${template.key}`,
      severity: moduleSeverity(linkedConditions, linkedCalculations),
      progress: linkedConditions.length
        ? Math.round(linkedConditions.reduce((sum, condition) => sum + normalizePercent(condition.completionScore), 0) / linkedConditions.length)
        : normalizePercent(fallbackProgress),
      conditionIds,
      calculationIds: linkedCalculations.map(item => item.id),
      sourceIds: linkedSources.map(item => item.id),
      breakthroughIds: linkedBreakthroughs.map(item => item.id),
    };
  });

  const gapOrders = input.calculations.reduce<number | null>((largest, calculation) => {
    const value = finiteNumber(calculation.gapOrders);
    return value === null ? largest : largest === null ? value : Math.max(largest, value);
  }, null);

  return {
    artifactType,
    artifactLabel: artifactLabels(ru)[artifactType],
    title: input.hypothesis.title,
    modules,
    conditions: input.conditions.slice(0, 16),
    calculations: input.calculations.slice(0, 8),
    sources: input.sources.slice(0, 8),
    breakthroughs: input.breakthroughSessions.slice(0, 8),
    metrics: [
      {key: 'research', value: normalizePercent(input.hypothesis.researchProgress)},
      {key: 'functionality', value: normalizePercent(input.hypothesis.functionalityProgress)},
      {key: 'testability', value: normalizePercent(input.hypothesis.testabilityProgress)},
      {key: 'confidence', value: normalizePercent(input.hypothesis.confidence)},
      {key: 'evidence', value: Math.min(100, input.sources.length * 14 + input.calculations.length * 8)},
    ],
    gapOrders,
    criticalCount: input.conditions.filter(condition => condition.importance === 'CRITICAL' || condition.status === 'CONFLICTS_WITH_KNOWN_SCIENCE').length,
  };
}

function selectTemplate(templates: ModuleTemplate[], text: string, index: number): ModuleTemplate {
  const normalized = text.toLowerCase();
  let best = templates[index % templates.length];
  let bestScore = 0;
  for (const template of templates) {
    const score = template.keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }
  return best;
}

function moduleSeverity(conditions: EngineeringConditionInput[], calculations: EngineeringCalculationInput[]): EngineeringSeverity {
  if (conditions.some(condition => condition.importance === 'CRITICAL' || condition.status === 'CONFLICTS_WITH_KNOWN_SCIENCE')) return 'critical';
  if (conditions.some(condition => condition.status === 'NEEDS_BREAKTHROUGH' || condition.status === 'ENGINEERING_BLOCKED')) return 'warning';
  if (calculations.some(calculation => calculation.gapLevel === 'EXTREME' || (calculation.gapOrders ?? 0) > 6)) return 'critical';
  if (conditions.length && conditions.every(condition => normalizePercent(condition.completionScore) >= 65)) return 'success';
  return 'info';
}

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const percent = value <= 1 ? value * 100 : value;
  return Math.round(Math.min(100, Math.max(0, percent)));
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function artifactLabels(ru: boolean): Record<EngineeringArtifactType, string> {
  return ru
    ? {flying_vehicle: 'Летающий транспорт', wearable_suit: 'Носимый инженерный костюм', battery: 'Энергетический модуль', propulsion_system: 'Двигательная система', generic_device: 'Экспериментальное устройство'}
    : {flying_vehicle: 'Flying vehicle', wearable_suit: 'Wearable engineering suit', battery: 'Energy storage module', propulsion_system: 'Propulsion system', generic_device: 'Experimental device'};
}

function moduleTemplates(type: EngineeringArtifactType, ru: boolean): ModuleTemplate[] {
  const copy = moduleCopy(ru);
  const common: Record<EngineeringArtifactType, Array<[string, EngineeringGeometry, Vector3Tuple, Vector3Tuple, Vector3Tuple, string, string[]]>> = {
    flying_vehicle: [
      ['body', 'box', [0, 0, 0], [0, 0, 0], [1.65, .42, .82], '#35d5d0', ['body', 'chassis', 'frame', 'structure', 'корпус', 'каркас', 'конструкц']],
      ['cabin', 'box', [0, .56, -.12], [0, 1.8, -.35], [.78, .38, .78], '#55b9ff', ['cabin', 'cockpit', 'pilot', 'кабин', 'пилот', 'экипаж']],
      ['lift', 'box', [0, .05, 0], [0, .35, 2.25], [2.65, .12, .5], '#45e0b7', ['wing', 'rotor', 'lift', 'hover', 'крыл', 'ротор', 'подъ', 'висен']],
      ['propulsion', 'cylinder', [0, -.02, .12], [0, -.15, -2.35], [.44, .52, .44], '#ff765f', ['thrust', 'engine', 'propulsion', 'motor', 'тяга', 'двигател', 'мотор']],
      ['power', 'box', [0, -.52, .18], [0, -1.75, .35], [1.05, .22, .52], '#f4bf4f', ['power', 'energy', 'battery', 'fuel', 'энерг', 'аккумулятор', 'топлив']],
      ['control', 'box', [0, .22, -1.02], [0, .55, -2.75], [.52, .2, .3], '#a58cff', ['control', 'navigation', 'stability', 'sensor', 'управлен', 'навигац', 'стабил', 'датчик']],
    ],
    wearable_suit: [
      ['torso', 'box', [0, .42, 0], [0, .42, 0], [.72, .82, .34], '#35d5d0', ['torso', 'frame', 'structure', 'material', 'торс', 'каркас', 'материал']],
      ['helmet', 'sphere', [0, 1.62, 0], [0, 2.75, .25], [.48, .48, .48], '#55b9ff', ['helmet', 'sensor', 'vision', 'шлем', 'датчик', 'визор']],
      ['arms', 'cylinder', [0, .35, 0], [2.1, .55, 0], [.24, .9, .24], '#45e0b7', ['arm', 'actuator', 'force', 'joint', 'рук', 'привод', 'усили']],
      ['legs', 'cylinder', [0, -1.18, 0], [-2.05, -1.45, 0], [.3, 1.05, .3], '#45e0b7', ['leg', 'actuator', 'balance', 'ног', 'привод', 'баланс']],
      ['power_core', 'cylinder', [0, .48, .42], [0, .48, 1.85], [.32, .18, .32], '#f4bf4f', ['power', 'energy', 'core', 'battery', 'энерг', 'ядро', 'аккумулятор']],
      ['thrusters', 'cylinder', [0, -2.05, .08], [0, -3.15, .8], [.28, .45, .28], '#ff765f', ['thrust', 'flight', 'thermal', 'тяга', 'полёт', 'тепл', 'сопло']],
    ],
    battery: [
      ['casing', 'box', [0, 0, 0], [0, 0, 0], [1.45, 1.35, .78], '#35d5d0', ['case', 'casing', 'enclosure', 'pressure', 'корпус', 'давлен']],
      ['cells', 'cylinder', [0, 0, 0], [0, 0, 2.2], [.25, 1.1, .25], '#f4bf4f', ['cell', 'anode', 'cathode', 'lithium', 'ячейк', 'анод', 'катод', 'литий']],
      ['separator', 'box', [0, 0, .18], [-2.05, 0, .2], [.12, 1.08, .56], '#55b9ff', ['separator', 'membrane', 'сепаратор', 'мембран']],
      ['terminals', 'cylinder', [0, 1.48, 0], [0, 2.6, .2], [.18, .25, .18], '#45e0b7', ['terminal', 'contact', 'bus', 'клемм', 'контакт', 'шина']],
      ['air_filter', 'box', [0, -.95, .82], [0, -2.05, 1.65], [.72, .24, .22], '#a58cff', ['air', 'filter', 'vent', 'cool', 'воздух', 'фильтр', 'вент', 'охлаж']],
      ['control', 'box', [1.12, .82, .25], [2.3, 1.25, .65], [.34, .34, .48], '#ff765f', ['control', 'management', 'safety', 'bms', 'управлен', 'безопас', 'контрол']],
    ],
    propulsion_system: [
      ['frame', 'cylinder', [0, 0, 0], [0, 0, 0], [1.05, 2.2, 1.05], '#35d5d0', ['frame', 'structure', 'housing', 'корпус', 'каркас']],
      ['power', 'sphere', [0, 1.12, 0], [0, 2.45, 0], [.62, .62, .62], '#f4bf4f', ['power', 'energy', 'fuel', 'энерг', 'топлив']],
      ['chamber', 'cylinder', [0, .05, 0], [0, .05, 1.8], [.78, .92, .78], '#ff765f', ['chamber', 'pressure', 'combust', 'камера', 'давлен']],
      ['field', 'torus', [0, -.6, 0], [0, -.6, 1.75], [1.05, 1.05, .3], '#a58cff', ['field', 'magnetic', 'plasma', 'поле', 'магнит', 'плазм']],
      ['nozzle', 'cylinder', [0, -1.55, 0], [0, -3, 0], [.76, .92, .76], '#45e0b7', ['nozzle', 'thrust', 'exhaust', 'сопло', 'тяга']],
      ['control', 'box', [.92, .7, 0], [2, 1.3, 0], [.38, .55, .72], '#55b9ff', ['control', 'stability', 'navigation', 'управлен', 'стабил']],
    ],
    generic_device: [
      ['chassis', 'box', [0, 0, 0], [0, 0, 0], [1.65, 1.15, 1.05], '#35d5d0', ['frame', 'structure', 'material', 'корпус', 'материал']],
      ['power', 'cylinder', [-.8, .2, 0], [-2, .4, 0], [.48, .82, .48], '#f4bf4f', ['power', 'energy', 'battery', 'энерг', 'аккумулятор']],
      ['core', 'sphere', [0, .15, .35], [0, .15, 1.9], [.72, .72, .72], '#45e0b7', ['core', 'effect', 'field', 'ядро', 'эффект', 'поле']],
      ['control', 'box', [.9, .25, 0], [2.05, .55, 0], [.42, .65, .72], '#55b9ff', ['control', 'software', 'управлен', 'контрол']],
      ['thermal', 'torus', [0, -.72, 0], [0, -1.8, .8], [.78, .78, .26], '#ff765f', ['heat', 'thermal', 'cool', 'тепл', 'охлаж']],
      ['sensors', 'sphere', [0, .92, 0], [0, 2, .65], [.4, .4, .4], '#a58cff', ['sensor', 'measure', 'signal', 'датчик', 'измер']],
    ],
  };

  return common[type].map(([key, geometry, position, explodedPosition, scale, color, keywords]) => ({
    key,
    geometry,
    position,
    explodedPosition,
    scale,
    color,
    keywords,
    label: copy[key]?.label ?? key,
    description: copy[key]?.description ?? '',
  }));
}

function moduleCopy(ru: boolean): Record<string, {label: string; description: string}> {
  return ru ? {
    body: {label: 'Несущий корпус', description: 'Силовая платформа, аэродинамическая форма и распределение нагрузки.'},
    cabin: {label: 'Кабина', description: 'Защищённый объём экипажа, обзор и интерфейсы управления.'},
    lift: {label: 'Подъёмная система', description: 'Крылья, роторы и поверхности, создающие и стабилизирующие подъёмную силу.'},
    propulsion: {label: 'Тяговые модули', description: 'Двигатели и движители для горизонтальной тяги и манёвра.'},
    torso: {label: 'Бронекорпус торса', description: 'Несущая структура, защита и распределение нагрузки на тело.'},
    helmet: {label: 'Шлем и визор', description: 'Защита головы, обзор, связь и сенсорный интерфейс.'},
    arms: {label: 'Модули рук', description: 'Приводы плеч, локтей и кистей с передачей усилия.'},
    legs: {label: 'Модули ног', description: 'Опорные приводы, балансировка и передача нагрузки на поверхность.'},
    power_core: {label: 'Энергетическое ядро', description: 'Компактный источник энергии и силовая распределительная шина.'},
    thrusters: {label: 'Маневровые двигатели', description: 'Тяговые модули ног и стабилизация положения в полёте.'},
    casing: {label: 'Корпус батареи', description: 'Защита ячеек, изоляция и механическое удержание пакета.'},
    cells: {label: 'Пакет ячеек', description: 'Стек электрохимических ячеек, определяющий ёмкость и мощность.'},
    terminals: {label: 'Силовые клеммы', description: 'Токосъём, соединительные шины и внешние силовые контакты.'},
    air_filter: {label: 'Воздушный фильтр', description: 'Вентиляционный канал, фильтрация и отвод тепла от пакета.'},
    frame: {label: 'Несущий каркас', description: 'Геометрия, нагрузка и структурные материалы.'},
    chassis: {label: 'Корпус устройства', description: 'Базовая конструкция и интерфейсы модулей.'},
    power: {label: 'Энергетический модуль', description: 'Источник энергии, мощность и плотность хранения.'},
    actuators: {label: 'Система приводов', description: 'Передача усилия, движение и механические пределы.'},
    control: {label: 'Контур управления', description: 'Стабилизация, обратная связь и алгоритмы контроля.'},
    thermal: {label: 'Тепловой контур', description: 'Отвод тепла и рабочие температурные пределы.'},
    sensors: {label: 'Измерительный блок', description: 'Датчики, сигнал и чувствительность измерения.'},
    enclosure: {label: 'Защитный корпус', description: 'Изоляция, давление и механическая безопасность.'},
    anode: {label: 'Анодный модуль', description: 'Активный материал и предел удельной ёмкости.'},
    cathode: {label: 'Катодный модуль', description: 'Реакционная поверхность и транспорт вещества.'},
    separator: {label: 'Сепаратор', description: 'Ионный перенос и предотвращение короткого замыкания.'},
    electrolyte: {label: 'Электролит', description: 'Проводимость, химическая стабильность и потери.'},
    chamber: {label: 'Рабочая камера', description: 'Область формирования рабочего эффекта.'},
    field: {label: 'Полевой контур', description: 'Катушки, плазма или иное активное поле.'},
    nozzle: {label: 'Выходной модуль', description: 'Формирование тяги и передача импульса.'},
    core: {label: 'Функциональное ядро', description: 'Главный механизм проверяемого эффекта.'},
  } : {
    body: {label: 'Load-bearing body', description: 'Structural platform, aerodynamic form, and load distribution.'},
    cabin: {label: 'Cabin', description: 'Protected crew volume, visibility, and control interfaces.'},
    lift: {label: 'Lift system', description: 'Wings, rotors, and surfaces that create and stabilize lift.'},
    propulsion: {label: 'Propulsion modules', description: 'Engines and propulsors for forward thrust and maneuvering.'},
    torso: {label: 'Torso armor', description: 'Load-bearing protection and force distribution around the body.'},
    helmet: {label: 'Helmet and visor', description: 'Head protection, vision, communications, and sensor interface.'},
    arms: {label: 'Arm modules', description: 'Shoulder, elbow, and wrist actuators with force transfer.'},
    legs: {label: 'Leg modules', description: 'Support actuators, balance, and load transfer to the ground.'},
    power_core: {label: 'Power core', description: 'Compact energy source and primary power distribution bus.'},
    thrusters: {label: 'Maneuvering thrusters', description: 'Leg propulsion modules and in-flight attitude control.'},
    casing: {label: 'Battery casing', description: 'Cell protection, insulation, and mechanical pack retention.'},
    cells: {label: 'Cell stack', description: 'Electrochemical cell array that determines capacity and power.'},
    terminals: {label: 'Power terminals', description: 'Current collection, bus bars, and external power contacts.'},
    air_filter: {label: 'Air and filter module', description: 'Ventilation path, filtration, and heat removal from the pack.'},
    frame: {label: 'Load-bearing frame', description: 'Geometry, loads, and structural materials.'},
    chassis: {label: 'Device chassis', description: 'Base structure and module interfaces.'},
    power: {label: 'Power module', description: 'Energy source, power delivery, and storage density.'},
    actuators: {label: 'Actuator system', description: 'Force transfer, motion, and mechanical limits.'},
    control: {label: 'Control loop', description: 'Stabilization, feedback, and control algorithms.'},
    thermal: {label: 'Thermal circuit', description: 'Heat rejection and operating temperature limits.'},
    sensors: {label: 'Measurement block', description: 'Sensors, signal quality, and measurement sensitivity.'},
    enclosure: {label: 'Protective enclosure', description: 'Isolation, pressure, and mechanical safety.'},
    anode: {label: 'Anode module', description: 'Active material and specific-capacity limit.'},
    cathode: {label: 'Cathode module', description: 'Reaction surface and mass transport.'},
    separator: {label: 'Separator', description: 'Ion transport and short-circuit prevention.'},
    electrolyte: {label: 'Electrolyte', description: 'Conductivity, chemical stability, and losses.'},
    chamber: {label: 'Working chamber', description: 'Region where the target effect is generated.'},
    field: {label: 'Field circuit', description: 'Coils, plasma, or another active field system.'},
    nozzle: {label: 'Output module', description: 'Thrust shaping and momentum transfer.'},
    core: {label: 'Functional core', description: 'Primary mechanism behind the testable effect.'},
  };
}
