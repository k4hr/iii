import type {ReactNode} from 'react';

export function HypothesisCockpitShell({children, stickyNav}: {children: ReactNode; stickyNav: ReactNode}) {
  return (
    <div className="space-y-6 py-3">
      <div className="sticky top-3 z-20 rounded-2xl border border-cyan-100/[0.1] bg-[#020708]/88 p-2 shadow-[0_0_50px_rgba(0,0,0,.42)] backdrop-blur-xl">
        {stickyNav}
      </div>
      {children}
    </div>
  );
}
