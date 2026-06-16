'use client';

import {EngineeringOverlayEditor, type OverlayEditorLabels} from '@/components/engineering/EngineeringOverlayEditor';
import {EngineeringPrimitiveEditor, type PrimitiveEditorLabels} from '@/components/engineering/EngineeringPrimitiveEditor';
import type {
  CanonicalEngineeringGeometryPrimitive,
  CanonicalEngineeringModel,
  CanonicalEngineeringPhysicalModule,
  CanonicalEngineeringResearchOverlay,
  EngineeringPhysicalCategory,
  EngineeringPhysicalGeometryHint,
  EngineeringPositionHint,
} from '@/lib/engineering/engineering-model-schema';

const categories: EngineeringPhysicalCategory[] = ['body', 'cabin', 'lift', 'propulsion', 'energy', 'control', 'thermal', 'safety', 'sensor', 'material', 'measurement', 'unknown'];
const geometryHints: EngineeringPhysicalGeometryHint[] = ['body', 'cabin', 'wing', 'rotor', 'thruster', 'battery_pack', 'control_core', 'heat_sink', 'sensor_array', 'shield', 'frame', 'cell_stack', 'generic'];
const positionHints: EngineeringPositionHint[] = ['center', 'front', 'rear', 'left', 'right', 'top', 'bottom', 'internal', 'external'];

export type EngineeringModelEditorLabels = PrimitiveEditorLabels & OverlayEditorLabels & {
  viewMode: string;
  editMode: string;
  warning: string;
  save: string;
  saving: string;
  cancel: string;
  addModule: string;
  newModuleName: string;
  newModuleRole: string;
  newOverlayTitle: string;
  deleteModule: string;
  deleteModuleDisabled: string;
  moduleName: string;
  moduleRole: string;
  moduleDescription: string;
  category: string;
  geometryHint: string;
  positionHint: string;
  feasibility: string;
  reset: string;
  resetConfirm: string;
  categoryLabels: Record<EngineeringPhysicalCategory, string>;
  geometryHintLabels: Record<EngineeringPhysicalGeometryHint, string>;
  positionHintLabels: Record<EngineeringPositionHint, string>;
};

export function EngineeringModelEditorPanel({
  isPending,
  labels,
  model,
  onCancel,
  onChange,
  onReset,
  onSave,
  onSelectModule,
  selectedModuleId,
}: {
  isPending: boolean;
  labels: EngineeringModelEditorLabels;
  model: CanonicalEngineeringModel;
  onCancel: () => void;
  onChange: (model: CanonicalEngineeringModel) => void;
  onReset: () => void;
  onSave: () => void;
  onSelectModule: (id: string) => void;
  selectedModuleId: string;
}) {
  const selectedModule = model.physicalModules.find(module => module.id === selectedModuleId) ?? model.physicalModules[0];
  if (!selectedModule) return null;
  const primitives = model.geometryPlan.primitives.filter(primitive => primitive.moduleId === selectedModule.id);
  const overlays = model.researchOverlays.filter(overlay => overlay.linkedModuleId === selectedModule.id);
  const canDeleteModule = selectedModule.id.startsWith('user-') && model.physicalModules.length > 1;

  return (
    <div className="space-y-4 rounded-2xl border border-cyan-100/[0.08] bg-[linear-gradient(145deg,rgba(10,36,39,.72),rgba(0,0,0,.38))] p-4">
      <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-[10px] leading-5 text-amber-100/70">{labels.warning}</div>

      <div className="flex flex-wrap gap-2">
        <button className="editor-button" disabled={isPending} onClick={() => addModule(model, labels, onChange, onSelectModule)} type="button">{labels.addModule}</button>
        <button className="editor-button" disabled={isPending || !canDeleteModule} onClick={() => deleteModule(model, selectedModule.id, onChange, onSelectModule)} title={canDeleteModule ? labels.deleteModule : labels.deleteModuleDisabled} type="button">{labels.deleteModule}</button>
      </div>

      <div className="space-y-3 rounded-2xl border border-cyan-100/[0.07] bg-black/25 p-4">
        <div className="mono-label">{labels.moduleName}</div>
        <label className="editor-field">
          <span>{labels.moduleName}</span>
          <input maxLength={160} onChange={event => updateModule(model, selectedModule.id, {name: event.target.value}, onChange)} value={selectedModule.name} />
        </label>
        <label className="editor-field">
          <span>{labels.moduleRole}</span>
          <textarea maxLength={280} onChange={event => updateModule(model, selectedModule.id, {role: event.target.value}, onChange)} rows={3} value={selectedModule.role} />
        </label>
        <label className="editor-field">
          <span>{labels.moduleDescription}</span>
          <textarea maxLength={700} onChange={event => updateModule(model, selectedModule.id, {description: event.target.value}, onChange)} rows={3} value={selectedModule.description ?? ''} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="editor-field">
            <span>{labels.category}</span>
            <select value={selectedModule.category} onChange={event => updateModule(model, selectedModule.id, {category: event.target.value as EngineeringPhysicalCategory}, onChange)}>
              {categories.map(category => <option key={category} value={category}>{labels.categoryLabels[category]}</option>)}
            </select>
          </label>
          <label className="editor-field">
            <span>{labels.feasibility}</span>
            <input max={100} min={0} onChange={event => updateModule(model, selectedModule.id, {feasibilityScore: clamp(Number(event.target.value), 0, 100)}, onChange)} type="number" value={selectedModule.feasibilityScore} />
          </label>
          <label className="editor-field">
            <span>{labels.geometryHint}</span>
            <select value={selectedModule.geometryHint} onChange={event => updateModule(model, selectedModule.id, {geometryHint: event.target.value as EngineeringPhysicalGeometryHint}, onChange)}>
              {geometryHints.map(hint => <option key={hint} value={hint}>{labels.geometryHintLabels[hint]}</option>)}
            </select>
          </label>
          <label className="editor-field">
            <span>{labels.positionHint}</span>
            <select value={selectedModule.positionHint} onChange={event => updateModule(model, selectedModule.id, {positionHint: event.target.value as EngineeringPositionHint}, onChange)}>
              {positionHints.map(hint => <option key={hint} value={hint}>{labels.positionHintLabels[hint]}</option>)}
            </select>
          </label>
        </div>
      </div>

      <EngineeringPrimitiveEditor
        labels={labels}
        onAdd={() => addPrimitive(model, selectedModule.id, onChange)}
        onChange={primitive => updatePrimitive(model, primitive, onChange)}
        onDelete={primitiveId => deletePrimitive(model, primitiveId, onChange)}
        primitives={primitives}
      />
      <EngineeringOverlayEditor
        labels={labels}
        onAdd={() => addOverlay(model, selectedModule.id, labels.newOverlayTitle, onChange)}
        onChange={overlay => updateOverlay(model, overlay, onChange)}
        onDelete={overlayId => deleteOverlay(model, overlayId, onChange)}
        overlays={overlays}
      />

      <div className="flex flex-wrap justify-between gap-2 border-t border-cyan-100/[0.07] pt-3">
        <button className="editor-button" disabled={isPending} onClick={onReset} type="button">{labels.reset}</button>
        <div className="flex gap-2">
          <button className="editor-button" disabled={isPending} onClick={onCancel} type="button">{labels.cancel}</button>
          <button className="rounded-lg border border-cyan-200/35 bg-cyan-300/10 px-3 py-2 font-mono text-[9px] tracking-[.09em] text-cyan-50 uppercase transition-colors hover:border-cyan-100/60 disabled:opacity-50" disabled={isPending} onClick={onSave} type="button">
            {isPending ? labels.saving : labels.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function updateModule(model: CanonicalEngineeringModel, moduleId: string, patch: Partial<CanonicalEngineeringPhysicalModule>, onChange: (model: CanonicalEngineeringModel) => void) {
  onChange({...model, physicalModules: model.physicalModules.map(module => module.id === moduleId ? {...module, ...patch} : module)});
}

function addModule(model: CanonicalEngineeringModel, labels: EngineeringModelEditorLabels, onChange: (model: CanonicalEngineeringModel) => void, onSelectModule: (id: string) => void) {
  const id = `user-module-${Date.now()}`;
  const module: CanonicalEngineeringPhysicalModule = {
    id,
    name: labels.newModuleName,
    role: labels.newModuleRole,
    description: '',
    category: 'unknown',
    geometryHint: 'generic',
    positionHint: 'external',
    feasibilityScore: 40,
    linkedConditionIds: [],
    linkedCalculationIds: [],
    linkedSourceIds: [],
  };
  const primitive = createPrimitive(id, model.geometryPlan.primitives[0]?.position ?? [0, 0, 0]);
  onChange({
    ...model,
    physicalModules: [...model.physicalModules, module],
    geometryPlan: {
      ...model.geometryPlan,
      primitives: [...model.geometryPlan.primitives, primitive],
      connectors: model.geometryPlan.primitives[0] ? [...model.geometryPlan.connectors, {fromPrimitiveId: model.geometryPlan.primitives[0].id, toPrimitiveId: primitive.id, type: 'structural'}] : model.geometryPlan.connectors,
    },
  });
  onSelectModule(id);
}

function deleteModule(model: CanonicalEngineeringModel, moduleId: string, onChange: (model: CanonicalEngineeringModel) => void, onSelectModule: (id: string) => void) {
  const removedPrimitiveIds = new Set(model.geometryPlan.primitives.filter(primitive => primitive.moduleId === moduleId).map(primitive => primitive.id));
  const nextModules = model.physicalModules.filter(module => module.id !== moduleId);
  onChange({
    ...model,
    physicalModules: nextModules,
    interfaces: model.interfaces.filter(link => link.fromModuleId !== moduleId && link.toModuleId !== moduleId),
    researchOverlays: model.researchOverlays.filter(overlay => overlay.linkedModuleId !== moduleId),
    geometryPlan: {
      ...model.geometryPlan,
      primitives: model.geometryPlan.primitives.filter(primitive => primitive.moduleId !== moduleId),
      connectors: model.geometryPlan.connectors.filter(connector => !removedPrimitiveIds.has(connector.fromPrimitiveId) && !removedPrimitiveIds.has(connector.toPrimitiveId)),
    },
  });
  onSelectModule(nextModules[0]?.id ?? '');
}

function addPrimitive(model: CanonicalEngineeringModel, moduleId: string, onChange: (model: CanonicalEngineeringModel) => void) {
  const base = model.geometryPlan.primitives.find(primitive => primitive.moduleId === moduleId)?.position ?? [0, 0, 0];
  const primitive = createPrimitive(moduleId, base);
  onChange({...model, geometryPlan: {...model.geometryPlan, primitives: [...model.geometryPlan.primitives, primitive]}});
}

function createPrimitive(moduleId: string, base: [number, number, number]): CanonicalEngineeringGeometryPrimitive {
  return {
    id: `user-primitive-${moduleId}-${Date.now()}`,
    moduleId,
    shape: 'rounded_box',
    position: [clamp(base[0] + 0.25, -20, 20), base[1], base[2]],
    rotation: [0, 0, 0],
    scale: [0.42, 0.28, 0.42],
    materialRole: 'structure',
    opacity: 0.78,
  };
}

function updatePrimitive(model: CanonicalEngineeringModel, primitive: CanonicalEngineeringGeometryPrimitive, onChange: (model: CanonicalEngineeringModel) => void) {
  onChange({...model, geometryPlan: {...model.geometryPlan, primitives: model.geometryPlan.primitives.map(item => item.id === primitive.id ? primitive : item)}});
}

function deletePrimitive(model: CanonicalEngineeringModel, primitiveId: string, onChange: (model: CanonicalEngineeringModel) => void) {
  const modulePrimitiveCount = model.geometryPlan.primitives.filter(primitive => primitive.moduleId === model.geometryPlan.primitives.find(item => item.id === primitiveId)?.moduleId).length;
  if (modulePrimitiveCount <= 1) return;
  onChange({
    ...model,
    geometryPlan: {
      ...model.geometryPlan,
      primitives: model.geometryPlan.primitives.filter(primitive => primitive.id !== primitiveId),
      connectors: model.geometryPlan.connectors.filter(connector => connector.fromPrimitiveId !== primitiveId && connector.toPrimitiveId !== primitiveId),
    },
  });
}

function addOverlay(model: CanonicalEngineeringModel, moduleId: string, title: string, onChange: (model: CanonicalEngineeringModel) => void) {
  const overlay: CanonicalEngineeringResearchOverlay = {id: `user-overlay-${moduleId}-${Date.now()}`, linkedModuleId: moduleId, type: 'blocker', title, severity: 'warning'};
  onChange({...model, researchOverlays: [...model.researchOverlays, overlay]});
}

function updateOverlay(model: CanonicalEngineeringModel, overlay: CanonicalEngineeringResearchOverlay, onChange: (model: CanonicalEngineeringModel) => void) {
  onChange({...model, researchOverlays: model.researchOverlays.map(item => item.id === overlay.id ? overlay : item)});
}

function deleteOverlay(model: CanonicalEngineeringModel, overlayId: string, onChange: (model: CanonicalEngineeringModel) => void) {
  onChange({...model, researchOverlays: model.researchOverlays.filter(overlay => overlay.id !== overlayId)});
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
