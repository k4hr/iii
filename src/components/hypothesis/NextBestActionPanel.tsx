import type {ReactNode} from 'react';

export function NextBestActionPanel({
  action,
  kicker,
  mainBlocker,
  mainBlockerLabel,
  reason,
  title,
}: {
  action: ReactNode;
  kicker: string;
  mainBlocker?: string;
  mainBlockerLabel: string;
  reason: string;
  title: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-cyan-100/[0.1] bg-[linear-gradient(135deg,rgba(11,44,48,.82),rgba(0,0,0,.48))] p-5">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_35%,rgba(34,211,238,.13),transparent_45%)]" />
      <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="section-kicker">{kicker}</div>
          <h2 className="mt-3 text-xl font-semibold tracking-[-.03em] text-cyan-50">{title}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-[#91adaf]">{reason}</p>
          {mainBlocker && (
            <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.035] px-3 py-2">
              <div className="font-mono text-[8px] tracking-[.1em] text-rose-100/45 uppercase">{mainBlockerLabel}</div>
              <p className="mt-1 text-xs text-rose-50/75">{mainBlocker}</p>
            </div>
          )}
        </div>
        <div className="flex justify-start lg:justify-end">{action}</div>
      </div>
    </section>
  );
}
