import type {VisualNodeType} from '@/lib/visual-lab/build-visual-model';

export type VisualLabLegendLabels = {
  title: string;
  hypothesis: string;
  condition: string;
  blocker: string;
  calculation: string;
  source: string;
  connection: string;
  progress: string;
};

const items: Array<{key: keyof Omit<VisualLabLegendLabels, 'title'>; type?: VisualNodeType; className: string}> = [
  {key: 'hypothesis', type: 'hypothesis', className: 'border-cyan-200 bg-cyan-300'},
  {key: 'condition', type: 'condition', className: 'border-cyan-100/70 bg-[#102b2d]'},
  {key: 'blocker', type: 'blocker', className: 'border-red-200 bg-red-300'},
  {key: 'calculation', type: 'calculation', className: 'border-amber-200 bg-amber-300'},
  {key: 'source', type: 'source', className: 'border-emerald-200 bg-emerald-300'},
  {key: 'connection', className: 'h-px w-5 border-0 bg-cyan-200/60'},
  {key: 'progress', className: 'border-cyan-200/80 bg-transparent'},
];

export function VisualLabLegend({labels}: {labels: VisualLabLegendLabels}) {
  return (
    <aside className="rounded-2xl border border-cyan-100/[0.09] bg-[#02090b]/85 p-4 backdrop-blur-xl">
      <div className="font-mono text-[9px] tracking-[.14em] text-cyan-100/40 uppercase">{labels.title}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {items.map(item => (
          <div className="flex items-center gap-3 text-[10px] text-cyan-50/60" key={item.key}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${item.className}`} />
            <span>{labels[item.key]}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
