import type {ReactNode} from 'react';

export function HypothesisWorkspaceShell({
  children,
  stickyNav,
}: {
  children: ReactNode;
  stickyNav: ReactNode;
}) {
  return (
    <div className="space-y-6 py-3">
      <div className="sticky top-3 z-20 rounded-2xl border border-cyan-100/[0.08] bg-[#020708]/85 p-2 shadow-[0_0_40px_rgba(0,0,0,.35)] backdrop-blur-xl">
        {stickyNav}
      </div>
      {children}
    </div>
  );
}
