import {
  CalculationType,
  ConditionImportance,
  ConditionStatus,
  RealityGapLevel,
  Scale,
} from '@prisma/client';

export type CalculationGapLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

export type CalculationContext = {
  locale: string;
  hypothesisTitle: string;
  hypothesisText: string;
  scale?: Scale | null;
  realityGap?: RealityGapLevel | null;
  conditionTitle?: string | null;
  conditionDescription?: string | null;
  conditionStatus?: ConditionStatus | null;
  conditionImportance?: ConditionImportance | null;
  completionScore?: number | null;
};

export type OrderOfMagnitudeResult = {
  title: string;
  calculationType: CalculationType;
  input: {
    subject: string;
    requiredValue: number;
    availableValue: number;
    unit: string;
    comparison: 'required_over_available' | 'available_over_required';
    basis: string;
  };
  result: {
    ratio: number;
    gapOrders: number;
    gapLevel: CalculationGapLevel;
    requiredValue: number;
    availableValue: number;
    unit: string;
  };
  explanation: string;
};

const statusGapOrders: Partial<Record<ConditionStatus, number>> = {
  KNOWN_WORKING: 0.3,
  KNOWN_LIMITED: 1,
  TESTABLE: 1.5,
  UNKNOWN: 3,
  UNDEFINED: 4,
  ENGINEERING_BLOCKED: 6,
  NEEDS_BREAKTHROUGH: 9,
  CONFLICTS_WITH_KNOWN_SCIENCE: 12,
};

const realityGapOrders: Record<RealityGapLevel, number> = {
  LOW: 1,
  MEDIUM: 3,
  HIGH: 6,
  EXTREME: 10,
  UNKNOWN: 4,
};

const importanceAdjustment: Record<ConditionImportance, number> = {
  LOW: 0,
  MEDIUM: 0.5,
  HIGH: 1,
  CRITICAL: 1.5,
};

const availableEnergyByScale: Record<Scale, number> = {
  QUANTUM: 1e-15,
  ATOMIC: 1e-12,
  MOLECULAR: 1e-9,
  NANO: 1e-6,
  MICRO: 1,
  HUMAN: 1e9,
  PLANETARY: 1e18,
  STELLAR: 1e26,
  COSMOLOGICAL: 1e40,
  UNKNOWN: 1e6,
};

export function classifyOrderOfMagnitudeGap(gapOrders: number): CalculationGapLevel {
  if (gapOrders <= 1) return 'LOW';
  if (gapOrders <= 3) return 'MEDIUM';
  if (gapOrders <= 6) return 'HIGH';
  return 'EXTREME';
}

export function getCalculationTypeLabel(type: CalculationType, locale: string): string {
  const ru = locale.toLowerCase() === 'ru';
  const labels: Record<CalculationType, [string, string]> = {
    ENERGY_ESTIMATE: ['Energy estimate', 'Оценка энергии'],
    ENERGY_DENSITY_ESTIMATE: ['Energy density estimate', 'Оценка плотности энергии'],
    SCALE_GAP_ESTIMATE: ['Scale gap estimate', 'Оценка разрыва масштаба'],
    MATERIAL_LIMIT_ESTIMATE: ['Material limit estimate', 'Оценка предела материала'],
    MEASUREMENT_SENSITIVITY_ESTIMATE: ['Measurement sensitivity estimate', 'Оценка чувствительности измерений'],
    GENERIC_ORDER_OF_MAGNITUDE: ['Order-of-magnitude estimate', 'Оценка порядка величины'],
  };
  return labels[type][ru ? 1 : 0];
}

export function getCalculationGapLabel(level: CalculationGapLevel, locale: string): string {
  const ru = locale.toLowerCase() === 'ru';
  const labels: Record<CalculationGapLevel, [string, string]> = {
    LOW: ['Low gap', 'Низкий разрыв'],
    MEDIUM: ['Medium gap', 'Средний разрыв'],
    HIGH: ['High gap', 'Высокий разрыв'],
    EXTREME: ['Extreme gap', 'Экстремальный разрыв'],
  };
  return labels[level][ru ? 1 : 0];
}

export function getCalculationUnitLabel(unit: string, locale: string): string {
  if (locale.toLowerCase() !== 'ru') return unit;
  if (unit === 'relative') return 'отн. ед.';
  if (unit === 'scale ratio') return 'коэффициент масштаба';
  return unit;
}

export function createCalculationExplanation(
  values: {
    requiredValue: number;
    availableValue: number;
    unit: string;
    ratio: number;
    gapOrders: number;
    gapLevel: CalculationGapLevel;
  },
  locale: string
): string {
  const ru = locale.toLowerCase() === 'ru';
  const unit = getCalculationUnitLabel(values.unit, locale);
  return ru
    ? `Грубая оценка сравнивает требуемое значение ${formatScientific(values.requiredValue)} ${unit} с доступным ориентиром ${formatScientific(values.availableValue)} ${unit}. Разрыв составляет примерно ${formatScientific(values.ratio)}×, или ${values.gapOrders.toFixed(1)} порядка величины. Уровень: ${getCalculationGapLabel(values.gapLevel, locale).toLowerCase()}. Результат задаёт направление для проверки и не является точным инженерным расчётом.`
    : `This rough estimate compares a required value of ${formatScientific(values.requiredValue)} ${unit} with an available reference of ${formatScientific(values.availableValue)} ${unit}. The gap is approximately ${formatScientific(values.ratio)}×, or ${values.gapOrders.toFixed(1)} orders of magnitude. Level: ${getCalculationGapLabel(values.gapLevel, locale).toLowerCase()}. This result guides further validation and is not a precise engineering calculation.`;
}

export function selectCalculationType(context: CalculationContext): CalculationType {
  const text = `${context.conditionTitle ?? ''} ${context.conditionDescription ?? ''} ${context.hypothesisTitle} ${context.hypothesisText}`.toLowerCase();

  if (/energy density|specific energy|плотност.{0,8}энерг|удельн.{0,8}энерг/.test(text)) return CalculationType.ENERGY_DENSITY_ESTIMATE;
  if (/measurement|sensitivity|signal|precision|измер|чувствитель|сигнал|точност/.test(text)) return CalculationType.MEASUREMENT_SENSITIVITY_ESTIMATE;
  if (/material|stress|strength|pressure|temperature|материал|прочност|давлен|температур/.test(text)) return CalculationType.MATERIAL_LIMIT_ESTIMATE;
  if (/scale|size|distance|volume|mass|масштаб|размер|расстоян|объ.м|масса/.test(text)) return CalculationType.SCALE_GAP_ESTIMATE;
  if (/energy|power|field|энерг|мощност|поле/.test(text)) return CalculationType.ENERGY_ESTIMATE;
  return CalculationType.GENERIC_ORDER_OF_MAGNITUDE;
}

export function runOrderOfMagnitudeCalculation(context: CalculationContext): OrderOfMagnitudeResult {
  const calculationType = selectCalculationType(context);
  const gapOrders = estimateGapOrders(context);
  const values = estimateValues(calculationType, context.scale ?? Scale.UNKNOWN, gapOrders);
  const ratio = roundSignificant(values.comparison === 'required_over_available'
    ? values.requiredValue / values.availableValue
    : values.availableValue / values.requiredValue);
  const level = classifyOrderOfMagnitudeGap(gapOrders);
  const ru = context.locale.toLowerCase() === 'ru';
  const subject = context.conditionTitle || context.hypothesisTitle;
  const typeLabel = getCalculationTypeLabel(calculationType, context.locale);
  const title = `${typeLabel}: ${subject}`;
  const basis = ru
    ? 'Детерминированная предварительная оценка по масштабу, статусу, важности и текущему прогрессу условия.'
    : 'Deterministic preliminary estimate based on scale, status, importance and current condition progress.';
  const explanation = createCalculationExplanation({
    requiredValue: values.requiredValue,
    availableValue: values.availableValue,
    unit: values.unit,
    ratio,
    gapOrders,
    gapLevel: level,
  }, context.locale);

  return {
    title,
    calculationType,
    input: {
      subject,
      requiredValue: values.requiredValue,
      availableValue: values.availableValue,
      unit: values.unit,
      comparison: values.comparison,
      basis,
    },
    result: {
      ratio,
      gapOrders,
      gapLevel: level,
      requiredValue: values.requiredValue,
      availableValue: values.availableValue,
      unit: values.unit,
    },
    explanation,
  };
}

function estimateGapOrders(context: CalculationContext): number {
  const base = context.conditionStatus
    ? statusGapOrders[context.conditionStatus] ?? 4
    : context.realityGap
      ? realityGapOrders[context.realityGap]
      : 4;
  const importance = context.conditionImportance ? importanceAdjustment[context.conditionImportance] : 0;
  const progressReduction = Math.min(2, Math.max(0, context.completionScore ?? 0) / 50);
  return Math.round(Math.min(15, Math.max(0.2, base + importance - progressReduction)) * 10) / 10;
}

function estimateValues(type: CalculationType, scale: Scale, gapOrders: number) {
  const multiplier = 10 ** gapOrders;

  switch (type) {
    case CalculationType.ENERGY_ESTIMATE: {
      const availableValue = availableEnergyByScale[scale];
      return {requiredValue: roundSignificant(availableValue * multiplier), availableValue, unit: 'J', comparison: 'required_over_available' as const};
    }
    case CalculationType.ENERGY_DENSITY_ESTIMATE: {
      const availableValue = 1e6;
      return {requiredValue: roundSignificant(availableValue * multiplier), availableValue, unit: 'J/kg', comparison: 'required_over_available' as const};
    }
    case CalculationType.MATERIAL_LIMIT_ESTIMATE: {
      const availableValue = 1e9;
      return {requiredValue: roundSignificant(availableValue * multiplier), availableValue, unit: 'Pa', comparison: 'required_over_available' as const};
    }
    case CalculationType.MEASUREMENT_SENSITIVITY_ESTIMATE: {
      const availableValue = 1e-9;
      return {requiredValue: roundSignificant(availableValue / multiplier), availableValue, unit: 'relative', comparison: 'available_over_required' as const};
    }
    case CalculationType.SCALE_GAP_ESTIMATE:
      return {requiredValue: roundSignificant(multiplier), availableValue: 1, unit: 'scale ratio', comparison: 'required_over_available' as const};
    default:
      return {requiredValue: roundSignificant(multiplier), availableValue: 1, unit: 'relative', comparison: 'required_over_available' as const};
  }
}

function roundSignificant(value: number): number {
  if (value === 0) return 0;
  return Number(value.toPrecision(4));
}

function formatScientific(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1e4 || Math.abs(value) < 1e-3) return value.toExponential(2);
  return Number(value.toPrecision(3)).toString();
}
