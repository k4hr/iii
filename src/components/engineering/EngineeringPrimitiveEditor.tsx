'use client';

import type {CanonicalEngineeringGeometryPrimitive, EngineeringGeometryMaterialRole, EngineeringGeometryShape, Vector3Tuple} from '@/lib/engineering/engineering-model-schema';

const shapes: EngineeringGeometryShape[] = ['box', 'rounded_box', 'sphere', 'cylinder', 'cone', 'torus', 'disc', 'ring', 'wing', 'curved_blade', 'panel', 'capsule', 'tube', 'lattice', 'cell_stack'];
const materialRoles: EngineeringGeometryMaterialRole[] = ['body', 'glass', 'energy', 'thermal', 'control', 'propulsion', 'sensor', 'shield', 'structure', 'unknown'];

export type PrimitiveEditorLabels = {
  geometryPrimitives: string;
  addPrimitive: string;
  deletePrimitive: string;
  shape: string;
  position: string;
  rotation: string;
  scale: string;
  materialRole: string;
  opacity: string;
  shapeLabels: Record<EngineeringGeometryShape, string>;
  materialRoleLabels: Record<EngineeringGeometryMaterialRole, string>;
};

export function EngineeringPrimitiveEditor({
  labels,
  primitives,
  onAdd,
  onChange,
  onDelete,
}: {
  labels: PrimitiveEditorLabels;
  primitives: CanonicalEngineeringGeometryPrimitive[];
  onAdd: () => void;
  onChange: (primitive: CanonicalEngineeringGeometryPrimitive) => void;
  onDelete: (primitiveId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-cyan-100/[0.07] bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="mono-label">{labels.geometryPrimitives}</div>
        <button className="editor-button" onClick={onAdd} type="button">{labels.addPrimitive}</button>
      </div>
      <div className="mt-3 space-y-3">
        {primitives.map(primitive => (
          <div className="rounded-xl border border-cyan-100/[0.07] bg-white/[0.02] p-3" key={primitive.id}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="editor-field">
                <span>{labels.shape}</span>
                <select value={primitive.shape} onChange={event => onChange({...primitive, shape: event.target.value as EngineeringGeometryShape})}>
                  {shapes.map(shape => <option key={shape} value={shape}>{labels.shapeLabels[shape]}</option>)}
                </select>
              </label>
              <label className="editor-field">
                <span>{labels.materialRole}</span>
                <select value={primitive.materialRole} onChange={event => onChange({...primitive, materialRole: event.target.value as EngineeringGeometryMaterialRole})}>
                  {materialRoles.map(role => <option key={role} value={role}>{labels.materialRoleLabels[role]}</option>)}
                </select>
              </label>
            </div>
            <VectorEditor label={labels.position} value={primitive.position} onChange={value => onChange({...primitive, position: value})} />
            <VectorEditor label={labels.rotation} value={primitive.rotation} onChange={value => onChange({...primitive, rotation: value})} />
            <VectorEditor label={labels.scale} min={0.04} value={primitive.scale} onChange={value => onChange({...primitive, scale: value})} />
            <label className="editor-field mt-3">
              <span>{labels.opacity}</span>
              <input max={1} min={0.05} onChange={event => onChange({...primitive, opacity: clamp(Number(event.target.value), 0.05, 1)})} step={0.05} type="number" value={primitive.opacity ?? 0.75} />
            </label>
            <button className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.04] px-3 py-2 font-mono text-[9px] tracking-[.08em] text-rose-100/70 uppercase hover:border-rose-200/40" onClick={() => onDelete(primitive.id)} type="button">
              {labels.deletePrimitive}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function VectorEditor({label, min = -20, value, onChange}: {label: string; min?: number; value: Vector3Tuple; onChange: (value: Vector3Tuple) => void}) {
  return (
    <div className="mt-3">
      <div className="mb-1 font-mono text-[8px] tracking-[.08em] text-cyan-100/35 uppercase">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {value.map((item, index) => (
          <input
            className="editor-input"
            key={index}
            max={20}
            min={min}
            onChange={event => {
              const next = [...value] as Vector3Tuple;
              next[index] = clamp(Number(event.target.value), min, 20);
              onChange(next);
            }}
            step={0.05}
            type="number"
            value={item}
          />
        ))}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
