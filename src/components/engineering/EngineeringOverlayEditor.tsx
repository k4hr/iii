'use client';

import type {CanonicalEngineeringResearchOverlay, EngineeringSeverity} from '@/lib/engineering/engineering-model-schema';

type OverlayType = CanonicalEngineeringResearchOverlay['type'];
const overlayTypes: OverlayType[] = ['blocker', 'calculation', 'source', 'experiment', 'breakthrough'];
const severities: EngineeringSeverity[] = ['info', 'success', 'warning', 'critical'];

export type OverlayEditorLabels = {
  researchOverlays: string;
  addOverlay: string;
  deleteOverlay: string;
  overlayTitle: string;
  overlayType: string;
  severityLabel: string;
  gapOrders: string;
  overlayTypeLabels: Record<OverlayType, string>;
  severity: Record<EngineeringSeverity, string>;
};

export function EngineeringOverlayEditor({
  labels,
  overlays,
  onAdd,
  onChange,
  onDelete,
}: {
  labels: OverlayEditorLabels;
  overlays: CanonicalEngineeringResearchOverlay[];
  onAdd: () => void;
  onChange: (overlay: CanonicalEngineeringResearchOverlay) => void;
  onDelete: (overlayId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-cyan-100/[0.07] bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="mono-label">{labels.researchOverlays}</div>
        <button className="editor-button" onClick={onAdd} type="button">{labels.addOverlay}</button>
      </div>
      <div className="mt-3 space-y-3">
        {overlays.map(overlay => (
          <div className="rounded-xl border border-cyan-100/[0.07] bg-white/[0.02] p-3" key={overlay.id}>
            <label className="editor-field">
              <span>{labels.overlayTitle}</span>
              <input maxLength={220} onChange={event => onChange({...overlay, title: event.target.value})} value={overlay.title} />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="editor-field">
                <span>{labels.overlayType}</span>
                <select value={overlay.type} onChange={event => onChange({...overlay, type: event.target.value as OverlayType})}>
                  {overlayTypes.map(type => <option key={type} value={type}>{labels.overlayTypeLabels[type]}</option>)}
                </select>
              </label>
              <label className="editor-field">
                <span>{labels.severityLabel}</span>
                <select value={overlay.severity} onChange={event => onChange({...overlay, severity: event.target.value as EngineeringSeverity})}>
                  {severities.map(severity => <option key={severity} value={severity}>{labels.severity[severity]}</option>)}
                </select>
              </label>
            </div>
            <label className="editor-field mt-3">
              <span>{labels.gapOrders}</span>
              <input
                max={100}
                min={0}
                onChange={event => {
                  const next = event.target.value === '' ? undefined : Math.max(0, Math.min(100, Number(event.target.value)));
                  onChange({...overlay, ...(next === undefined || Number.isNaN(next) ? {gapOrders: undefined} : {gapOrders: next})});
                }}
                step={0.5}
                type="number"
                value={overlay.gapOrders ?? ''}
              />
            </label>
            <button className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.04] px-3 py-2 font-mono text-[9px] tracking-[.08em] text-rose-100/70 uppercase hover:border-rose-200/40" onClick={() => onDelete(overlay.id)} type="button">
              {labels.deleteOverlay}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
