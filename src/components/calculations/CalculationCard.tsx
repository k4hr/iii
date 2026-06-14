import type {CalculationType, Prisma} from '@prisma/client';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {
  CalculationGapLevel,
  createCalculationExplanation,
  getCalculationGapLabel,
  getCalculationTypeLabel,
  getCalculationUnitLabel,
} from '@/lib/calculations/order-of-magnitude';

type CalculationCardLabels = {
  inputs: string;
  result: string;
  required: string;
  available: string;
  ratio: string;
  orders: string;
  preliminary: string;
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
  const explanation = gapLevel
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

      <p className="mt-5 border-t border-cyan-100/[0.07] pt-5 text-xs leading-6 text-[#91adaf]">{explanation}</p>
    </GlassPanel>
  );
}

function Metric({label, value}: {label: string; value: string}) {
  return <div className="rounded-xl border border-cyan-100/[0.07] bg-black/30 p-4"><div className="mono-label">{label}</div><div className="mt-3 font-mono text-lg text-cyan-100/80">{value}</div></div>;
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

function asGapLevel(value: Prisma.JsonValue | undefined): CalculationGapLevel | null {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'EXTREME' ? value : null;
}

function formatNumber(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1e4 || Math.abs(value) < 1e-3) return value.toExponential(2);
  return Number(value.toPrecision(3)).toLocaleString('en-US');
}
