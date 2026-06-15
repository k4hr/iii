import type {CalculationType, Prisma} from '@prisma/client';
import type {ParameterPlaygroundLabels} from '@/components/calculations/ParameterPlayground';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {
  CalculationGapLevel,
  createCalculationExplanation,
  getCalculationGapLabel,
  getCalculationTypeLabel,
  getCalculationUnitLabel,
} from '@/lib/calculations/order-of-magnitude';
import {getEnumLabel} from '@/lib/locale/enum-labels';

type CalculationCardLabels = {
  inputs: string;
  result: string;
  required: string;
  available: string;
  ratio: string;
  orders: string;
  preliminary: string;
  energyGap: string;
  scaleGap: string;
  measurementFeasibility: string;
  feasible: string;
  notFeasible: string;
  mainBlocker: string;
  suggestedNextAction: string;
  researchProgress: string;
  functionalityProgress: string;
  testabilityProgress: string;
  playground: ParameterPlaygroundLabels;
};

type CalculationCardProps = {
  calculation: {
    id: string;
    title: string;
    calculationType: CalculationType;
    inputJson: Prisma.JsonValue;
    resultJson: Prisma.JsonValue;
    explanation: string;
    createdAt: Date;
  };
  locale: string;
  labels: CalculationCardLabels;
  subject?: string | null;
};

export function CalculationCard({calculation, locale, labels, subject}: CalculationCardProps) {
  const input = asRecord(calculation.inputJson);
  const result = asRecord(calculation.resultJson);
  const unit = getCalculationUnitLabel(asString(result.unit) || asString(input.unit), locale);
  const gapLevel = asGapLevel(result.gapLevel);
  const requiredValue = asNumber(result.requiredValue) ?? asNumber(input.requiredValue) ?? 0;
  const availableValue = asNumber(result.availableValue) ?? asNumber(input.availableValue) ?? 0;
  const ratio = asNumber(result.ratio) ?? 0;
  const gapOrders = asNumber(result.gapOrders) ?? 0;
  const displaySubject = subject || asString(input.subject);
  const isParameterEstimate = asString(input.mode) === 'parameter_playground';
  const parameters = asRecord(input.parameters);
  const impact = asRecord(result.impact);
  const energyGap = asRecord(result.energyGap);
  const scaleGap = asRecord(result.scaleGap);
  const measurement = asRecord(result.measurementFeasibility);
  const energyUnit = getCalculationUnitLabel('J', locale);
  const massUnit = getCalculationUnitLabel('kg', locale);
  const sizeUnit = getCalculationUnitLabel('m', locale);
  const timeUnit = getCalculationUnitLabel('s', locale);
  const explanation = gapLevel && !isParameterEstimate
    ? createCalculationExplanation({requiredValue, availableValue, unit: asString(result.unit) || asString(input.unit), ratio, gapOrders, gapLevel}, locale)
    : calculation.explanation;

  return (
    <GlassPanel className="p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mono-label">{getCalculationTypeLabel(calculation.calculationType, locale)}</div>
          <h3 className="mt-3 text-lg font-semibold text-cyan-50">{displaySubject || calculation.title}</h3>
          <p className="mt-2 font-mono text-[9px] tracking-[.1em] text-cyan-100/30 uppercase">
            {labels.preliminary} · {new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {dateStyle: 'medium', timeStyle: 'short'}).format(calculation.createdAt)}
          </p>
        </div>
        {gapLevel && <StatusBadge value={gapLevel} locale={locale} label={getCalculationGapLabel(gapLevel, locale)} />}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={`${labels.inputs}: ${labels.required}`} value={`${formatNumber(requiredValue)} ${unit}`} />
        <Metric label={`${labels.inputs}: ${labels.available}`} value={`${formatNumber(availableValue)} ${unit}`} />
        <Metric label={`${labels.result}: ${labels.ratio}`} value={`${formatNumber(ratio)}×`} />
        <Metric label={`${labels.result}: ${labels.orders}`} value={gapOrders.toFixed(1)} />
      </div>

      {isParameterEstimate && (
        <>
          <div className="mt-5 grid gap-3 border-t border-cyan-100/[0.07] pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={labels.playground.objectScale} value={getEnumLabel(asString(parameters.objectScale), locale)} />
            <Metric label={labels.playground.objectMassKg} value={`${formatNumber(asNumber(parameters.objectMassKg) ?? 0)} ${massUnit}`} />
            <Metric label={labels.playground.objectSizeM} value={`${formatNumber(asNumber(parameters.objectSizeM) ?? 0)} ${sizeUnit}`} />
            <Metric label={labels.playground.availableEnergyJ} value={`${formatNumber(asNumber(parameters.availableEnergyJ) ?? 0)} ${energyUnit}`} />
            <Metric label={labels.playground.requiredEnergyJ} value={`${formatNumber(asNumber(parameters.requiredEnergyJ) ?? requiredValue)} ${energyUnit}`} />
            <Metric label={labels.playground.desiredEffect} value={getEffectLabel(asString(parameters.desiredEffect), labels.playground)} />
            <Metric label={labels.playground.observationTimeS} value={`${formatNumber(asNumber(parameters.observationTimeS) ?? 0)} ${timeUnit}`} />
            <Metric label={labels.playground.measurementSensitivity} value={formatNumber(asNumber(parameters.measurementSensitivity) ?? 0)} />
            <Metric label={labels.playground.fieldIntensity} value={formatNumber(asNumber(parameters.fieldIntensity) ?? 0)} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label={labels.energyGap} value={`${formatNumber(asNumber(energyGap.orders) ?? 0)} ${labels.orders.toLowerCase()}`} />
            <Metric label={labels.scaleGap} value={`${formatNumber(asNumber(scaleGap.orders) ?? 0)} ${labels.orders.toLowerCase()}`} />
            <Metric label={labels.measurementFeasibility} value={asBoolean(measurement.feasible) ? labels.feasible : labels.notFeasible} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ImpactMetric label={labels.researchProgress} value={asNumber(impact.researchProgress) ?? 0} />
            <ImpactMetric label={labels.functionalityProgress} value={asNumber(impact.functionalityProgress) ?? 0} />
            <ImpactMetric label={labels.testabilityProgress} value={asNumber(impact.testabilityProgress) ?? 0} />
          </div>

          <div className="mt-5 rounded-xl border border-amber-300/[0.12] bg-amber-300/[0.025] p-4">
            <div className="mono-label">{labels.mainBlocker}</div>
            <p className="mt-2 text-xs leading-5 text-amber-100/75">{asString(result.mainRemainingBlocker) || '—'}</p>
          </div>

          <div className="mt-4 rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.025] p-4">
            <div className="mono-label">{labels.suggestedNextAction}</div>
            <p className="mt-2 text-xs leading-5 text-cyan-100/75">{asString(result.suggestedNextExperiment) || '—'}</p>
          </div>

          {asString(parameters.notes) && <p className="mt-4 text-xs italic leading-5 text-[#78999b]">{asString(parameters.notes)}</p>}
        </>
      )}

      <p className="mt-5 border-t border-cyan-100/[0.07] pt-5 text-xs leading-6 text-[#91adaf]">{explanation}</p>
    </GlassPanel>
  );
}

function Metric({label, value}: {label: string; value: string}) {
  return <div className="rounded-xl border border-cyan-100/[0.07] bg-black/30 p-4"><div className="mono-label">{label}</div><div className="mt-3 font-mono text-lg text-cyan-100/80">{value}</div></div>;
}

function ImpactMetric({label, value}: {label: string; value: number}) {
  const positive = value >= 0;
  return <div className="rounded-xl border border-emerald-300/[0.1] bg-emerald-300/[0.025] p-4"><div className="mono-label">{label}</div><div className={`mt-3 font-mono text-lg ${positive ? 'text-emerald-200/80' : 'text-red-200/80'}`}>{positive ? '+' : ''}{value.toFixed(1)}</div></div>;
}

function asRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

function asNumber(value: Prisma.JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: Prisma.JsonValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function asBoolean(value: Prisma.JsonValue | undefined): boolean {
  return value === true;
}

function asGapLevel(value: Prisma.JsonValue | undefined): CalculationGapLevel | null {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'EXTREME' ? value : null;
}

function formatNumber(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1e4 || Math.abs(value) < 1e-3) return value.toExponential(2);
  return Number(value.toPrecision(3)).toLocaleString('en-US');
}

function getEffectLabel(value: string, labels: ParameterPlaygroundLabels): string {
  if (value === 'LOW') return labels.effects.low;
  if (value === 'HIGH') return labels.effects.high;
  if (value === 'EXTREME') return labels.effects.extreme;
  return labels.effects.medium;
}
