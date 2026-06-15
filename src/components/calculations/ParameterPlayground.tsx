import type {Scale} from '@prisma/client';
import {GlassPanel} from '@/components/ui/GlassPanel';
import {GlowButton} from '@/components/ui/GlowButton';
import {getEnumLabel} from '@/lib/locale/enum-labels';

export type ParameterPlaygroundLabels = {
  kicker: string;
  title: string;
  description: string;
  objectScale: string;
  objectMassKg: string;
  objectSizeM: string;
  availableEnergyJ: string;
  requiredEnergyJ: string;
  desiredEffect: string;
  observationTimeS: string;
  measurementSensitivity: string;
  sensitivityHelp: string;
  fieldIntensity: string;
  notes: string;
  notesPlaceholder: string;
  run: string;
  effects: {low: string; medium: string; high: string; extreme: string};
};

type ParameterPlaygroundProps = {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  labels: ParameterPlaygroundLabels;
  defaultScale?: Scale;
  compactDefaults?: boolean;
};

const scaleOptions: Scale[] = ['QUANTUM', 'ATOMIC', 'MOLECULAR', 'NANO', 'MICRO', 'HUMAN', 'PLANETARY', 'STELLAR', 'COSMOLOGICAL', 'UNKNOWN'];

export function ParameterPlayground({action, locale, labels, defaultScale = 'HUMAN', compactDefaults = false}: ParameterPlaygroundProps) {
  return (
    <GlassPanel glow className="data-grid p-5 sm:p-7">
      <div>
        <div className="section-kicker">{labels.kicker}</div>
        <h3 className="mt-3 text-xl font-semibold text-cyan-50">{labels.title}</h3>
        <p className="mt-3 max-w-4xl text-xs leading-6 text-[#78999b]">{labels.description}</p>
      </div>

      <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label={labels.objectScale}>
          <select className="lab-input" defaultValue={compactDefaults ? 'MICRO' : defaultScale} name="objectScale">
            {scaleOptions.map(scale => <option value={scale} key={scale}>{getEnumLabel(scale, locale)}</option>)}
          </select>
        </Field>
        <Field label={labels.objectMassKg}>
          <input className="lab-input" defaultValue={compactDefaults ? 0.01 : 1} min="1e-18" name="objectMassKg" step="any" type="number" required />
        </Field>
        <Field label={labels.objectSizeM}>
          <input className="lab-input" defaultValue={compactDefaults ? 0.001 : 1} min="1e-18" name="objectSizeM" step="any" type="number" required />
        </Field>
        <Field label={labels.availableEnergyJ}>
          <input className="lab-input" defaultValue={compactDefaults ? 1000000 : 1000000000} min="1e-30" name="availableEnergyJ" step="any" type="number" required />
        </Field>
        <Field label={labels.requiredEnergyJ}>
          <input className="lab-input" defaultValue={compactDefaults ? 10000 : 1000000000} min="1e-30" name="requiredEnergyJ" step="any" type="number" required />
        </Field>
        <Field label={labels.desiredEffect}>
          <select className="lab-input" defaultValue={compactDefaults ? 'LOW' : 'MEDIUM'} name="desiredEffect">
            <option value="LOW">{labels.effects.low}</option>
            <option value="MEDIUM">{labels.effects.medium}</option>
            <option value="HIGH">{labels.effects.high}</option>
            <option value="EXTREME">{labels.effects.extreme}</option>
          </select>
        </Field>
        <Field label={labels.observationTimeS}>
          <input className="lab-input" defaultValue={compactDefaults ? 3600 : 60} min="0.001" name="observationTimeS" step="any" type="number" required />
        </Field>
        <Field label={labels.measurementSensitivity} help={labels.sensitivityHelp}>
          <input className="lab-input" defaultValue={compactDefaults ? 1e-12 : 1e-9} min="1e-30" name="measurementSensitivity" step="any" type="number" required />
        </Field>
        <Field label={labels.fieldIntensity}>
          <input className="lab-input" defaultValue={1} min="0.000001" name="fieldIntensity" step="any" type="number" required />
        </Field>
        <Field className="sm:col-span-2 xl:col-span-4" label={labels.notes}>
          <textarea className="lab-input min-h-24 resize-y" maxLength={1000} name="notes" placeholder={labels.notesPlaceholder} />
        </Field>
        <div className="sm:col-span-2 xl:col-span-4 flex justify-end border-t border-cyan-100/[0.07] pt-5">
          <GlowButton>{labels.run}</GlowButton>
        </div>
      </form>
    </GlassPanel>
  );
}

function Field({label, help, className = '', children}: {label: string; help?: string; className?: string; children: React.ReactNode}) {
  return (
    <label className={`block ${className}`}>
      <span className="mono-label">{label}</span>
      <span className="mt-2 block">{children}</span>
      {help && <span className="mt-2 block text-[10px] leading-4 text-[#5f8082]">{help}</span>}
    </label>
  );
}
