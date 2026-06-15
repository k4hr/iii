'use client';

import {animate, createTimeline, stagger} from 'animejs';
import {useEffect, useMemo, useRef} from 'react';
import type {EngineeringRenderModule} from '@/lib/engineering/build-engineering-model';

export function EngineeringBlueprintOverlay({modules, selectedModuleId, onSelectModule}: {modules: EngineeringRenderModule[]; selectedModuleId: string; onSelectModule: (id: string) => void}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => modules.slice(0, 6), [modules]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const labels = root.querySelectorAll<HTMLElement>('[data-blueprint-label]');
    const lines = root.querySelectorAll<SVGPathElement>('[data-blueprint-line]');
    const markers = root.querySelectorAll<HTMLElement>('[data-blueprint-marker]');
    if (reducedMotion) {
      labels.forEach(item => { item.style.opacity = '1'; });
      lines.forEach(item => { item.style.strokeDashoffset = '0'; item.style.opacity = '.7'; });
      markers.forEach(item => { item.style.opacity = '1'; });
      return;
    }
    const timeline = createTimeline({defaults: {ease: 'out(3)'}})
      .add(lines, {strokeDashoffset: [1, 0], opacity: [0, .72], duration: 700, delay: stagger(45)}, 0)
      .add(labels, {opacity: [0, 1], translateX: (index: number) => index % 2 ? [12, 0] : [-12, 0], duration: 520, delay: stagger(55)}, 120)
      .add(markers, {opacity: [0, 1], scale: [.4, 1], duration: 340, delay: stagger(40)}, 280);
    return () => { timeline.revert(); };
  }, [visible]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const selected = root.querySelector<HTMLElement>(`[data-module-id="${CSS.escape(selectedModuleId)}"]`);
    if (!selected) return;
    const animation = animate(selected, {scale: [1, 1.035, 1], duration: 420, ease: 'out(3)'});
    return () => { animation.revert(); };
  }, [selectedModuleId]);

  return (
    <div className="pointer-events-none absolute inset-0 hidden sm:block" ref={rootRef}>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 560">
        {visible.map((module, index) => {
          const left = index % 2 === 0;
          const y = 88 + Math.floor(index / 2) * 162;
          const selected = module.id === selectedModuleId;
          return (
            <path
              d={`M ${left ? 185 : 815} ${y} L ${left ? 350 : 650} ${y} L ${left ? 462 : 538} ${220 + index * 16}`}
              data-blueprint-line
              fill="none"
              key={module.id}
              pathLength="1"
              stroke={selected ? '#c7fff9' : module.color}
              strokeDasharray="1"
              strokeDashoffset="1"
              strokeOpacity={selected ? .92 : .48}
              strokeWidth={selected ? 1.7 : .8}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {visible.map((module, index) => {
        const left = index % 2 === 0;
        const top = 9 + Math.floor(index / 2) * 28;
        return (
          <button
            className={`pointer-events-auto absolute w-[155px] rounded-lg border bg-[#02090b]/80 p-2.5 text-left backdrop-blur-md transition-colors hover:border-cyan-100/35 ${module.id === selectedModuleId ? 'border-cyan-100/45' : 'border-cyan-100/[0.09]'}`}
            data-blueprint-label
            data-module-id={module.id}
            key={module.id}
            onClick={() => onSelectModule(module.id)}
            style={{left: left ? '2.5%' : 'auto', opacity: 0, right: left ? 'auto' : '2.5%', top: `${top}%`}}
            type="button"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[8px] tracking-[.1em] text-cyan-50/65 uppercase">{module.name}</span>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" data-blueprint-marker style={{background: module.color, boxShadow: `0 0 10px ${module.color}`, opacity: 0}} />
            </span>
            <span className="mt-1.5 block font-mono text-[8px] text-cyan-100/35">M-{String(index + 1).padStart(2, '0')} / {module.feasibilityScore}%</span>
          </button>
        );
      })}
    </div>
  );
}
