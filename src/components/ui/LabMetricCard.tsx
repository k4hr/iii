import {ProgressRing} from '@/components/ui/ProgressRing';

export function LabMetricCard({label, value, detail}: {label: string; value: number; detail?: string}) {
  return (
    <div className="metric-card">
      <ProgressRing value={value} label={label} size={124} />
      {detail && <p className="metric-card__detail">{detail}</p>}
    </div>
  );
}
