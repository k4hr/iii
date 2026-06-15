'use client';

import Link from 'next/link';
import {animate} from 'animejs';
import {useEffect, useMemo, useRef, useState} from 'react';
import {EngineeringBlueprintOverlay} from '@/components/engineering/EngineeringBlueprintOverlay';
import {EngineeringChartsPanel} from '@/components/engineering/EngineeringChartsPanel';
import {EngineeringModelViewer} from '@/components/engineering/EngineeringModelViewer';
import {buildEngineeringRenderModules, type EngineeringSeverity} from '@/lib/engineering/build-engineering-model';
import type {CanonicalEngineeringModel} from '@/lib/engineering/engineering-model-schema';

export type EngineeringVisualLabLabels = {
  kicker: string;
  title: string;
  description: string;
  artifactType: string;
  explodedView: string;
  assembledView: string;
  resetCamera: string;
  selectedModule: string;
  moduleProgress: string;
  linkedBlockers: string;
  linkedCalculations: string;
  sourceCandidates: string;
  activeBreakthroughs: string;
  noLinkedItems: string;
  open: string;
  gapOrders: string;
  criticalModules: string;
  charts: string;
  mobileHint: string;
  abstractNotice: string;
  nextEngineeringStep: string;
  engineeringIntent: string;
  severity: Record<EngineeringSeverity, string>;
  metrics: Record<'research' | 'functionality' | 'testability' | 'confidence' | 'evidence', string>;
};

export type EngineeringRelatedRecords = {
  conditions: Array<{id: string; title: string; href?: string}>;
  calculations: Array<{id: string; title: string; href?: string}>;
  sources: Array<{id: string; title: string; href?: string}>;
  breakthroughs: Array<{id: string; conditionId: string; title: string; href?: string}>;
};

export function EngineeringVisualLab({model, labels, records}: {model: CanonicalEngineeringModel; labels: EngineeringVisualLabLabels; records?: EngineeringRelatedRecords}) {
  const renderModules = useMemo(() => buildEngineeringRenderModules(model), [model]);
  const [selectedModuleId, setSelectedModuleId] = useState(model.modules[0]?.id ?? '');
  const [exploded, setExploded] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedModule = model.modules.find(module => module.id === selectedModuleId) ?? model.modules[0];
  const selectedRenderModule = renderModules.find(module => module.id === selectedModule?.id) ?? renderModules[0];

  const linked = useMemo(() => ({
    conditions: records?.conditions.filter(item => selectedModule?.linkedConditionIds.includes(item.id)) ?? [],
    calculations: records?.calculations.filter(item => selectedModule?.linkedCalculationIds.includes(item.id)) ?? [],
    sources: records?.sources.filter(item => selectedModule?.linkedSourceIds.includes(item.id)) ?? [],
    breakthroughs: records?.breakthroughs.filter(item => selectedModule?.linkedConditionIds.includes(item.conditionId)) ?? [],
  }), [records, selectedModule]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = animate(panel, {opacity: [0, 1], translateY: [8, 0], duration: 420, ease: 'out(3)'});
    return () => { animation.revert(); };
  }, [selectedModuleId]);

  if (!selectedModule || !selectedRenderModule) return null;
  const largestGap = model.modules.reduce<number | null>((value, module) => module.gapOrders === undefined ? value : value === null ? module.gapOrders : Math.max(value, module.gapOrders), null);
  const criticalCount = model.modules.filter(module => module.priority === 'critical').length;

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-cyan-100/[0.1] bg-[#020708]/95 shadow-[0_0_80px_rgba(24,215,203,.055)]">
      <header className="grid gap-5 border-b border-cyan-100/[0.08] bg-[linear-gradient(90deg,rgba(8,39,42,.72),rgba(0,0,0,.25))] px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="section-kicker">{labels.kicker}</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] text-cyan-50 sm:text-3xl">{model.artifactName}</h2>
          <p className="mt-3 max-w-3xl text-xs leading-6 text-[#83a2a4]">{model.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ControlButton active={exploded} onClick={() => setExploded(value => !value)}>{exploded ? labels.assembledView : labels.explodedView}</ControlButton>
          <ControlButton onClick={() => setResetSignal(value => value + 1)}>{labels.resetCamera}</ControlButton>
        </div>
      </header>

      {model.materiality === 'abstract' && <div className="border-b border-amber-300/10 bg-amber-300/[0.035] px-5 py-3 text-xs leading-5 text-amber-100/65 sm:px-7">{labels.abstractNotice}</div>}

      <div className="grid gap-4 p-3 sm:p-5 xl:grid-cols-[minmax(0,1.5fr)_360px]">
        <div className="relative">
          <EngineeringModelViewer exploded={exploded} model={model} onSelectModule={setSelectedModuleId} resetSignal={resetSignal} selectedModuleId={selectedModuleId} />
          <EngineeringBlueprintOverlay modules={renderModules} onSelectModule={setSelectedModuleId} selectedModuleId={selectedModuleId} />
          <p className="mt-3 px-2 text-[10px] leading-5 text-cyan-100/35 sm:hidden">{labels.mobileHint}</p>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-cyan-100/[0.08] bg-[linear-gradient(145deg,rgba(10,36,39,.72),rgba(0,0,0,.38))] p-5" ref={panelRef}>
            <div className="flex items-start justify-between gap-4">
              <div><div className="mono-label">{labels.selectedModule}</div><h3 className="mt-3 text-lg font-semibold text-cyan-50">{selectedModule.name}</h3></div>
              <StatusPill label={labels.severity[selectedRenderModule.severity]} severity={selectedRenderModule.severity} />
            </div>
            <p className="mt-3 text-xs font-medium text-cyan-50/65">{selectedModule.role}</p>
            <p className="mt-2 text-xs leading-6 text-[#7e9fa1]">{selectedModule.description}</p>
            <div className="mt-5">
              <div className="flex justify-between font-mono text-[9px] tracking-[.08em] text-cyan-100/45 uppercase"><span>{labels.moduleProgress}</span><span>{selectedModule.feasibilityScore}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-700 to-cyan-300" style={{width: `${selectedModule.feasibilityScore}%`}} /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label={labels.artifactType} value={model.artifactClass.replaceAll('_', ' ')} />
            <MetricCard label={labels.gapOrders} value={largestGap === null ? '—' : `${largestGap} OOM`} />
            <MetricCard label={labels.criticalModules} value={String(criticalCount).padStart(2, '0')} />
            <MetricCard label={labels.sourceCandidates} value={String(records?.sources.length ?? 0).padStart(2, '0')} />
          </div>

          <InfoPanel label={labels.engineeringIntent} value={model.engineeringIntent} />
          <LinkedPanel items={linked.conditions} label={labels.linkedBlockers} noItems={labels.noLinkedItems} open={labels.open} />
          <LinkedPanel items={linked.calculations} label={labels.linkedCalculations} noItems={labels.noLinkedItems} open={labels.open} />
          <LinkedPanel items={linked.sources} label={labels.sourceCandidates} noItems={labels.noLinkedItems} open={labels.open} />
          {linked.breakthroughs.length > 0 && <LinkedPanel items={linked.breakthroughs} label={labels.activeBreakthroughs} noItems={labels.noLinkedItems} open={labels.open} />}
          <InfoPanel label={labels.nextEngineeringStep} value={model.nextEngineeringStep} />
        </aside>
      </div>

      <div className="border-t border-cyan-100/[0.07] p-4 sm:p-5">
        <div className="mb-3 mono-label">{labels.charts}</div>
        <EngineeringChartsPanel model={model} />
      </div>
    </section>
  );
}

function ControlButton({children, active = false, onClick}: {children: React.ReactNode; active?: boolean; onClick: () => void}) {
  return <button className={`rounded-lg border px-3 py-2 font-mono text-[9px] tracking-[.09em] uppercase transition-colors ${active ? 'border-cyan-200/40 bg-cyan-300/10 text-cyan-100' : 'border-cyan-100/[0.1] bg-black/30 text-cyan-100/55 hover:border-cyan-100/30 hover:text-cyan-100'}`} onClick={onClick} type="button">{children}</button>;
}

function StatusPill({label, severity}: {label: string; severity: EngineeringSeverity}) {
  const styles = {info: 'border-cyan-300/20 text-cyan-200/65', success: 'border-emerald-300/20 text-emerald-200/70', warning: 'border-amber-300/25 text-amber-200/75', critical: 'border-rose-300/30 text-rose-200/80'}[severity];
  return <span className={`rounded-full border bg-black/30 px-2 py-1 font-mono text-[8px] tracking-[.08em] uppercase ${styles}`}>{label}</span>;
}

function MetricCard({label, value}: {label: string; value: string}) {
  return <div className="rounded-xl border border-cyan-100/[0.07] bg-black/25 p-3"><div className="font-mono text-[8px] tracking-[.08em] text-cyan-100/35 uppercase">{label}</div><div className="mt-2 text-xs font-medium text-cyan-50/75 capitalize">{value}</div></div>;
}

function InfoPanel({label, value}: {label: string; value: string}) {
  return <div className="rounded-2xl border border-cyan-100/[0.07] bg-black/20 p-4"><div className="mono-label">{label}</div><p className="mt-3 text-[10px] leading-5 text-cyan-50/55">{value}</p></div>;
}

function LinkedPanel({label, items, noItems, open}: {label: string; items: Array<{id: string; title: string; href?: string}>; noItems: string; open: string}) {
  return (
    <div className="rounded-2xl border border-cyan-100/[0.07] bg-black/20 p-4">
      <div className="mono-label">{label}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.slice(0, 4).map(item => (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-cyan-100/[0.06] bg-white/[0.015] p-2.5" key={item.id}>
            <span className="text-[10px] leading-4 text-cyan-50/65">{item.title}</span>
            {item.href && <Link aria-label={open} className="shrink-0 font-mono text-[9px] text-cyan-200/55 hover:text-cyan-100" href={item.href}>↗</Link>}
          </div>
        )) : <p className="text-[10px] text-cyan-100/30">{noItems}</p>}
      </div>
    </div>
  );
}
