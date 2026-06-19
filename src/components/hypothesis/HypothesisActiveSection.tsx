import type {ReactNode} from 'react';

export function HypothesisActiveSection({children, code, description, title}: {children: ReactNode; code: string; description?: string; title: string}) {
  return (
    <section className="rounded-[1.6rem] border border-cyan-100/[0.09] bg-[#020708]/90 p-4 shadow-[0_0_70px_rgba(20,184,166,.045)] sm:p-6">
      <div className="mb-5 flex flex-col justify-between gap-3 border-b border-cyan-100/[0.07] pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mono-label">{code}</div>
          <h2 className="section-heading mt-2">{title}</h2>
          {description && <p className="mt-2 max-w-3xl text-xs leading-6 text-[#78999b]">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
