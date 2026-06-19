import {StatusBadge} from '@/components/ui/StatusBadge';
import {getEnumLabel, getExperimentDifficultyLabel, getExperimentTypeLabel, getSafetyLevelLabel} from '@/lib/locale/enum-labels';

export type ExperimentPlanLabels = {
  cost: string;
  dataToCollect: string;
  difficulty: string;
  expectedResult: string;
  experimentGoal: string;
  falsification: string;
  measurements: string;
  minimumViableTest: string;
  procedure: string;
  risks: string;
  safety: string;
  setup: string;
  successCriteria: string;
  variables: string;
  whatWeTest: string;
};

export function ExperimentPlanCard({experiment, index, labels, locale}: {experiment: any; index: number; labels: ExperimentPlanLabels; locale: string}) {
  const setup = jsonArray(experiment.setupJson);
  const equipment = jsonArray(experiment.equipmentJson ?? experiment.requiredEquipmentJson);
  const variables = jsonRecord(experiment.variablesJson);
  const measurements = jsonRecord(experiment.measurementsJson);
  const expected = jsonRecord(experiment.expectedResultsJson);
  const success = jsonArray(experiment.successCriteriaJson);
  const risks = jsonArray(experiment.risksJson);
  const cost = typeof experiment.costLevel === 'string' ? experiment.costLevel : 'UNKNOWN';
  const difficulty = typeof experiment.difficultyLevel === 'string' ? experiment.difficultyLevel : experiment.difficulty;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-cyan-100/[0.09] bg-[#020708]/88 p-5 shadow-[0_0_55px_rgba(20,184,166,.04)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,.1),transparent_36%)]" />
      <div className="relative">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="font-mono text-[9px] tracking-[.13em] text-cyan-100/35 uppercase">EXP-{String(index + 1).padStart(2, '0')}</div>
            <h3 className="mt-3 text-lg font-semibold tracking-[-.02em] text-cyan-50">{experiment.title}</h3>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-[#8aa5a8]">{experiment.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <StatusBadge value={experiment.status || 'PROPOSED'} locale={locale} label={getEnumLabel(experiment.status || 'PROPOSED', locale)} />
            <StatusBadge value={experiment.experimentType} locale={locale} label={getExperimentTypeLabel(experiment.experimentType, locale)} />
            <StatusBadge value={difficulty} locale={locale} label={getExperimentDifficultyLabel(difficulty, locale)} />
            <StatusBadge value={experiment.safetyLevel} locale={locale} label={getSafetyLevelLabel(experiment.safetyLevel, locale)} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <DataBlock label={labels.experimentGoal} value={experiment.objective || experiment.description} />
          <DataBlock label={labels.whatWeTest} value={experiment.hypothesisBeingTested || experiment.description} />
          <DataBlock label={labels.cost} value={getEnumLabel(cost, locale)} />
        </div>

        <details className="mt-5 rounded-2xl border border-cyan-100/[0.08] bg-black/25 p-4">
          <summary className="cursor-pointer font-mono text-[9px] tracking-[.12em] text-cyan-100/50 uppercase">{labels.minimumViableTest}</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <DataBlock label={labels.minimumViableTest} value={stringValue(expected.minimumViableTest)} />
            <ListBlock label={labels.setup} values={[...setup, ...equipment]} />
            <ListBlock label={labels.variables} values={[
              ...prefixList(labels.variables, jsonArray(variables.independent)),
              ...prefixList(labels.measurements, jsonArray(variables.dependent)),
              ...jsonArray(variables.control),
            ]} />
            <ListBlock label={labels.procedure} values={jsonArray(experiment.procedureJson)} ordered />
            <DataBlock label={labels.measurements} value={stringValue(measurements.method)} />
            <ListBlock label={labels.dataToCollect} values={jsonArray(measurements.dataToCollect)} />
            <DataBlock label={labels.expectedResult} value={stringValue(expected.expected) || experiment.expectedSignal} />
            <DataBlock label={labels.falsification} value={stringValue(expected.failure) || experiment.falsificationCriteria} />
            <ListBlock label={labels.successCriteria} values={success} />
            <ListBlock label={labels.risks} values={risks} />
          </div>
        </details>
      </div>
    </article>
  );
}

function DataBlock({label, value}: {label: string; value?: string | null}) {
  return <div className="rounded-xl border border-cyan-100/[0.07] bg-black/25 p-3"><div className="font-mono text-[8px] tracking-[.1em] text-cyan-100/35 uppercase">{label}</div><p className="mt-2 text-xs leading-5 text-cyan-50/65">{value || '—'}</p></div>;
}

function ListBlock({label, ordered = false, values}: {label: string; ordered?: boolean; values: string[]}) {
  const Tag = ordered ? 'ol' : 'ul';
  return <div className="rounded-xl border border-cyan-100/[0.07] bg-black/25 p-3"><div className="font-mono text-[8px] tracking-[.1em] text-cyan-100/35 uppercase">{label}</div><Tag className="mt-2 space-y-1 text-xs leading-5 text-cyan-50/65">{values.length ? values.map((value, index) => <li className={ordered ? 'ml-4 list-decimal' : 'ml-4 list-disc'} key={`${value}-${index}`}>{value}</li>) : <li className="list-none">—</li>}</Tag></div>;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function prefixList(prefix: string, values: string[]): string[] {
  return values.map(value => `${prefix}: ${value}`);
}
