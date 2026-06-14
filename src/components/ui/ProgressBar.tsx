export function ProgressBar({value, label}: {value: number; label?: string}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="w-full">
      <div className="mb-2.5 flex items-center justify-between gap-4">
        {label && <span className="text-[11px] font-semibold tracking-[.09em] text-[#8aa9aa] uppercase">{label}</span>}
        <span className="ml-auto font-mono text-xs text-cyan-100">{safe.toString().padStart(2, '0')}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-sm border border-cyan-100/[0.08] bg-black/50">
        <div className="absolute inset-0 grid grid-cols-10 gap-px opacity-40">
          {Array.from({length: 10}).map((_, index) => <span key={index} className="border-r border-black/70" />)}
        </div>
        <div
          className="relative h-full bg-gradient-to-r from-[#0c7e88] via-[#21cfc7] to-[#75f7e8] shadow-[0_0_16px_rgba(67,241,223,.35)] transition-[width] duration-700"
          style={{width: `${safe}%`}}
        />
      </div>
    </div>
  );
}
