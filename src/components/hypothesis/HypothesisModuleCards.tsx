import {HypothesisModuleCard, type HypothesisModuleCardItem} from '@/components/hypothesis/HypothesisModuleCard';

export type HypothesisModuleItem = HypothesisModuleCardItem;

export function HypothesisModuleCards({activeSection, label, modules}: {activeSection: string; label: string; modules: HypothesisModuleItem[]}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="section-kicker">{label}</div>
        <div className="h-px flex-1 bg-gradient-to-r from-cyan-200/15 to-transparent" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map(module => <HypothesisModuleCard active={module.id === activeSection} key={module.id} {...module} />)}
      </div>
    </section>
  );
}
