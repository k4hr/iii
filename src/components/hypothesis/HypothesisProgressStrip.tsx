import {GlassPanel} from '@/components/ui/GlassPanel';

export function HypothesisProgressStrip({items}: {items: Array<{label: string; value: number}>}) {
  return (
    <GlassPanel className="grid gap-3 p-4 sm:grid-cols-3">
      {items.map(item => (
        <div className="rounded-2xl border border-cyan-100/[0.07] bg-black/20 p-4" key={item.label}>
          <div className="flex justify-between gap-3 font-mono text-[9px] tracking-[.08em] text-cyan-100/45 uppercase">
            <span>{item.label}</span>
            <span>{Math.round(item.value)}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-700 via-teal-400 to-emerald-300" style={{width: `${Math.max(0, Math.min(100, item.value))}%`}} />
          </div>
        </div>
      ))}
    </GlassPanel>
  );
}
