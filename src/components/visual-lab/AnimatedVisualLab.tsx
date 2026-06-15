'use client';

import Link from 'next/link';
import {useEffect, useMemo, useRef, useState} from 'react';
import {animate, createTimeline, stagger} from 'animejs';
import {VisualLabLegend, type VisualLabLegendLabels} from '@/components/visual-lab/VisualLabLegend';
import {
  buildVisualModel,
  type VisualBreakthroughInput,
  type VisualCalculationInput,
  type VisualConditionInput,
  type VisualHypothesisInput,
  type VisualLabEdge,
  type VisualLabNode,
  type VisualNodeType,
  type VisualSourceInput,
} from '@/lib/visual-lab/build-visual-model';

type AnimatedVisualLabLabels = {
  kicker: string;
  title: string;
  description: string;
  confidence: string;
  gapOrders: string;
  open: string;
  more: string;
  selected: string;
  nodeTypes: Record<VisualNodeType, string>;
  legend: VisualLabLegendLabels;
};

type AnimatedVisualLabProps = {
  locale: string;
  hypothesis: VisualHypothesisInput;
  conditions: VisualConditionInput[];
  calculations: VisualCalculationInput[];
  sources: VisualSourceInput[];
  breakthroughSessions: VisualBreakthroughInput[];
  labels: AnimatedVisualLabLabels;
};

type PositionedNode = VisualLabNode & {x: number; y: number};

const nodeStyles: Record<VisualNodeType, string> = {
  hypothesis: 'border-cyan-200/55 bg-[#061a1d]/95 shadow-[0_0_35px_rgba(67,241,223,.18)]',
  condition: 'border-cyan-100/15 bg-[#071416]/95 shadow-[0_0_22px_rgba(67,241,223,.06)]',
  blocker: 'border-red-300/40 bg-[#1b0a0d]/95 shadow-[0_0_30px_rgba(248,113,113,.16)]',
  calculation: 'border-amber-300/35 bg-[#191307]/95 shadow-[0_0_24px_rgba(251,191,36,.12)]',
  source: 'border-emerald-300/30 bg-[#071712]/95 shadow-[0_0_24px_rgba(52,211,153,.1)]',
  breakthrough: 'border-violet-300/35 bg-[#100b1b]/95 shadow-[0_0_24px_rgba(196,181,253,.12)]',
};

const dotStyles: Record<VisualNodeType, string> = {
  hypothesis: 'bg-cyan-300 shadow-[0_0_12px_#43f1df]',
  condition: 'bg-cyan-100/65',
  blocker: 'bg-red-300 shadow-[0_0_12px_rgba(248,113,113,.9)]',
  calculation: 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,.7)]',
  source: 'bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,.7)]',
  breakthrough: 'bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,.7)]',
};

export function AnimatedVisualLab(props: AnimatedVisualLabProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const model = useMemo(() => buildVisualModel(props), [props]);
  const positionedNodes = useMemo(() => positionNodes(model.nodes), [model.nodes]);
  const positionById = useMemo(() => new Map(positionedNodes.map(node => [node.id, node])), [positionedNodes]);
  const [selectedId, setSelectedId] = useState(model.nodes[0]?.id || '');
  const selectedNode = model.nodes.find(node => node.id === selectedId) || model.nodes[0];

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodeElements = root.querySelectorAll<HTMLElement>('[data-visual-node]');
    const edgeElements = root.querySelectorAll<SVGPathElement>('[data-visual-edge]');
    const markerElements = root.querySelectorAll<HTMLElement>('[data-visual-marker]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      nodeElements.forEach(element => { element.style.opacity = '1'; });
      edgeElements.forEach(element => {
        element.style.opacity = '0.65';
        element.style.strokeDashoffset = '0';
      });
      markerElements.forEach(element => { element.style.opacity = '1'; });
      return;
    }

    const timeline = createTimeline({defaults: {ease: 'out(3)'}})
      .add(edgeElements, {strokeDashoffset: [1, 0], opacity: [0, 0.68], duration: 950, delay: stagger(35)}, 0)
      .add(nodeElements, {opacity: [0, 1], scale: [0.72, 1], translateY: [14, 0], duration: 720, delay: stagger(65, {from: 'center'})}, 160)
      .add(markerElements, {opacity: [0, 1], scale: [0.5, 1], duration: 420, delay: stagger(45)}, 460);
    const floating = animate(root.querySelectorAll<HTMLElement>('[data-visual-float]'), {
      translateY: [-3, 3],
      duration: 2400,
      delay: stagger(180),
      alternate: true,
      loop: true,
      ease: 'inOutSine',
    });
    const corePulse = animate(root.querySelectorAll<HTMLElement>('[data-visual-core]'), {
      scale: [1, 1.025],
      duration: 1800,
      alternate: true,
      loop: true,
      ease: 'inOutSine',
    });

    return () => {
      timeline.revert();
      floating.revert();
      corePulse.revert();
    };
  }, [model]);

  const animateInteraction = (element: HTMLElement, active: boolean) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate(element, {scale: active ? 1.055 : 1, duration: 220, ease: 'out(3)'});
  };

  return (
    <section ref={rootRef} className="overflow-hidden rounded-[1.75rem] border border-cyan-100/[0.1] bg-[#020708]/90 shadow-[0_0_70px_rgba(21,224,211,.06)]">
      <div className="flex flex-col gap-4 border-b border-cyan-100/[0.08] bg-black/30 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <div className="section-kicker">{props.labels.kicker}</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-.03em] text-cyan-50">{props.labels.title}</h2>
          <p className="mt-3 max-w-3xl text-xs leading-6 text-[#78999b]">{props.labels.description}</p>
        </div>
        {model.omittedCount > 0 && <span className="font-mono text-[9px] tracking-[.12em] text-cyan-100/40 uppercase">{props.labels.more.replace('{count}', String(model.omittedCount))}</span>}
      </div>

      <div className="grid gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative min-h-[620px] overflow-hidden rounded-2xl border border-cyan-100/[0.07] bg-[radial-gradient(circle_at_50%_48%,rgba(25,229,214,.11),transparent_23%),linear-gradient(rgba(74,222,210,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(74,222,210,.035)_1px,transparent_1px)] bg-[size:auto,34px_34px,34px_34px] sm:min-h-[650px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(1,6,7,.78)_92%)]" />
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 620">
            <defs>
              <linearGradient id="visual-edge-gradient" x1="0" x2="1">
                <stop offset="0" stopColor="#35e4d3" stopOpacity=".18" />
                <stop offset=".55" stopColor="#77f2e6" stopOpacity=".72" />
                <stop offset="1" stopColor="#35e4d3" stopOpacity=".18" />
              </linearGradient>
            </defs>
            {model.edges.map(edge => {
              const from = positionById.get(edge.from);
              const to = positionById.get(edge.to);
              if (!from || !to) return null;
              const selected = edge.from === selectedId || edge.to === selectedId;
              return <path data-visual-edge d={edgePath(from, to)} fill="none" key={edge.id} pathLength="1" stroke={edge.type === 'blocks' ? '#f87171' : 'url(#visual-edge-gradient)'} strokeDasharray="1" strokeDashoffset="1" strokeOpacity={selected ? .95 : .58} strokeWidth={selected ? 2.2 : 1.15} style={{opacity: 0, transition: 'stroke-width 180ms ease, stroke-opacity 180ms ease'}} vectorEffect="non-scaling-stroke" />;
            })}
          </svg>

          {positionedNodes.map(node => (
            <div className="absolute z-10" key={node.id} style={{left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)'}}>
              <button
                aria-pressed={selectedId === node.id}
                className={`group relative w-28 rounded-2xl border px-3 py-3 text-left backdrop-blur-md transition-[border-color,background-color] focus:outline-none focus:ring-2 focus:ring-cyan-200/45 sm:w-36 ${nodeStyles[node.type]} ${selectedId === node.id ? 'ring-1 ring-cyan-100/45' : ''}`}
                data-visual-core={node.type === 'hypothesis' ? '' : undefined}
                data-visual-float={node.type !== 'hypothesis' ? '' : undefined}
                data-visual-node
                onBlur={event => animateInteraction(event.currentTarget, false)}
                onClick={event => {
                  setSelectedId(node.id);
                  animateInteraction(event.currentTarget, true);
                }}
                onFocus={event => animateInteraction(event.currentTarget, true)}
                onMouseEnter={event => animateInteraction(event.currentTarget, true)}
                onMouseLeave={event => animateInteraction(event.currentTarget, false)}
                style={{opacity: 0}}
                type="button"
              >
                <span className={`absolute right-3 top-3 h-1.5 w-1.5 rounded-full ${dotStyles[node.type]}`} />
                <span className="font-mono text-[8px] tracking-[.12em] text-cyan-100/35 uppercase">{props.labels.nodeTypes[node.type]}</span>
                <span className="mt-2 block line-clamp-2 text-[10px] font-medium leading-4 text-cyan-50/85 sm:text-[11px]">{node.label}</span>
                {typeof node.value === 'number' && (
                  <span className="mt-3 flex items-center gap-2" data-visual-marker style={{opacity: 0}}>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full bg-cyan-300/70" style={{width: `${node.type === 'calculation' ? Math.min(100, node.value * 10) : Math.min(100, node.value)}%`}} /></span>
                    <span className="font-mono text-[8px] text-cyan-100/55">{node.type === 'calculation' ? `${node.value}` : `${Math.round(node.value)}%`}</span>
                  </span>
                )}
              </button>
            </div>
          ))}

          {selectedNode && (
            <div className="absolute bottom-3 left-3 right-3 z-20 rounded-2xl border border-cyan-100/[0.1] bg-[#02090b]/90 p-4 backdrop-blur-xl sm:left-5 sm:right-auto sm:w-[360px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[8px] tracking-[.13em] text-cyan-100/40 uppercase">{props.labels.selected} / {props.labels.nodeTypes[selectedNode.type]}</div>
                  <h3 className="mt-2 text-sm font-semibold text-cyan-50">{selectedNode.label}</h3>
                </div>
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotStyles[selectedNode.type]}`} />
              </div>
              <div className="mt-3 flex flex-wrap gap-3 font-mono text-[9px] text-cyan-100/45">
                {typeof selectedNode.metadata?.confidence === 'number' && <span>{props.labels.confidence}: {selectedNode.metadata.confidence}%</span>}
                {typeof selectedNode.metadata?.gapOrders === 'number' && <span>{props.labels.gapOrders}: {selectedNode.metadata.gapOrders}</span>}
                {typeof selectedNode.value === 'number' && selectedNode.type !== 'calculation' && <span>{props.labels.legend.progress}: {Math.round(selectedNode.value)}%</span>}
              </div>
              {selectedNode.href && <Link className="mt-4 inline-flex font-mono text-[9px] tracking-[.1em] text-cyan-200/70 uppercase transition-colors hover:text-cyan-100" href={selectedNode.href}>{props.labels.open} →</Link>}
            </div>
          )}
        </div>

        <VisualLabLegend labels={props.labels.legend} />
      </div>
    </section>
  );
}

function positionNodes(nodes: VisualLabNode[]): PositionedNode[] {
  if (!nodes.length) return [];
  const result: PositionedNode[] = [{...nodes[0], x: 50, y: 45}];
  const satellites = nodes.slice(1);
  const total = satellites.length;
  satellites.forEach((node, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index / Math.max(1, total));
    const outer = node.type === 'calculation' || node.type === 'source' || node.type === 'breakthrough';
    const radiusX = outer ? 43 : 34;
    const radiusY = outer ? 39 : 31;
    result.push({...node, x: 50 + Math.cos(angle) * radiusX, y: 45 + Math.sin(angle) * radiusY});
  });
  return result;
}

function edgePath(from: PositionedNode, to: PositionedNode): string {
  const x1 = from.x * 10;
  const y1 = from.y * 6.2;
  const x2 = to.x * 10;
  const y2 = to.y * 6.2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const bend = Math.min(28, Math.hypot(x2 - x1, y2 - y1) * 0.05);
  return `M ${x1} ${y1} Q ${mx - bend} ${my + bend} ${x2} ${y2}`;
}
