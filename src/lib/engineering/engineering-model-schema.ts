import {z} from 'zod';

export const engineeringMaterialitySchema = z.enum(['material', 'abstract', 'hybrid']);
export const engineeringArtifactClassSchema = z.enum([
  'device', 'vehicle', 'wearable', 'battery', 'reactor', 'propulsion', 'sensor', 'material_system', 'infrastructure', 'unknown',
]);

export const engineeringPhysicalCategorySchema = z.enum([
  'body', 'cabin', 'lift', 'propulsion', 'energy', 'control', 'thermal', 'safety', 'sensor', 'material', 'measurement', 'unknown',
]);
export const engineeringPhysicalGeometryHintSchema = z.enum([
  'body', 'cabin', 'wing', 'rotor', 'thruster', 'battery_pack', 'control_core', 'heat_sink', 'sensor_array', 'shield', 'frame', 'cell_stack', 'generic',
]);
export const engineeringPositionHintSchema = z.enum([
  'center', 'front', 'rear', 'left', 'right', 'top', 'bottom', 'internal', 'external',
]);
export const engineeringOverlayTypeSchema = z.enum(['blocker', 'calculation', 'source', 'experiment', 'breakthrough']);
export const engineeringSeveritySchema = z.enum(['info', 'success', 'warning', 'critical']);

export const engineeringInterfaceTypeSchema = z.enum(['energy', 'control', 'heat', 'material_flow', 'signal', 'structural']);
export const engineeringMetricStatusSchema = z.enum(['ok', 'warning', 'critical']);
export const engineeringChartTypeSchema = z.enum(['energy_gap', 'mass_budget', 'thermal_load', 'testability', 'feasibility']);
export const engineeringGeometryLayoutSchema = z.enum(['symmetric', 'radial', 'linear', 'layered', 'humanoid', 'vehicle', 'winged', 'ring', 'freeform']);
export const engineeringGeometryShapeSchema = z.enum(['box', 'rounded_box', 'sphere', 'cylinder', 'cone', 'torus', 'disc', 'ring', 'wing', 'curved_blade', 'panel', 'capsule', 'tube', 'lattice', 'cell_stack']);
export const engineeringGeometryMaterialRoleSchema = z.enum(['body', 'glass', 'energy', 'thermal', 'control', 'propulsion', 'sensor', 'shield', 'structure', 'unknown']);
export const engineeringGeometryConnectorTypeSchema = z.enum(['structural', 'energy', 'signal', 'heat', 'force', 'material_flow']);

const vector3Schema = z.tuple([
  z.number().min(-20).max(20),
  z.number().min(-20).max(20),
  z.number().min(-20).max(20),
]);

export const engineeringGeometryPrimitiveSchema = z.object({
  id: z.string().min(1).max(100),
  moduleId: z.string().min(1).max(80),
  shape: engineeringGeometryShapeSchema,
  position: vector3Schema,
  rotation: vector3Schema,
  scale: vector3Schema,
  materialRole: engineeringGeometryMaterialRoleSchema,
  opacity: z.number().min(0).max(1).optional(),
}).strict();

export const engineeringGeometryPlanSchema = z.object({
  layout: engineeringGeometryLayoutSchema,
  primitives: z.array(engineeringGeometryPrimitiveSchema).min(1).max(80),
  connectors: z.array(z.object({
    fromPrimitiveId: z.string().min(1).max(100),
    toPrimitiveId: z.string().min(1).max(100),
    type: engineeringGeometryConnectorTypeSchema,
  }).strict()).max(96),
}).strict();

export const engineeringPhysicalModuleSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  role: z.string().min(1).max(280),
  category: engineeringPhysicalCategorySchema,
  geometryHint: engineeringPhysicalGeometryHintSchema,
  positionHint: engineeringPositionHintSchema,
  feasibilityScore: z.number().min(0).max(100),
  linkedConditionIds: z.array(z.string()).max(32),
  linkedCalculationIds: z.array(z.string()).max(32),
  linkedSourceIds: z.array(z.string()).max(32),
}).strict();

export const engineeringResearchOverlaySchema = z.object({
  id: z.string().min(1).max(100),
  linkedModuleId: z.string().min(1).max(80),
  type: engineeringOverlayTypeSchema,
  title: z.string().min(1).max(220),
  severity: engineeringSeveritySchema,
  gapOrders: z.number().min(0).max(100).optional(),
}).strict();

const legacyEngineeringModuleSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  role: z.string().min(1).max(280),
  description: z.string().optional(),
  category: z.enum(['power', 'structure', 'control', 'thermal', 'propulsion', 'material', 'sensor', 'safety', 'measurement', 'unknown']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  feasibilityScore: z.number().min(0).max(100),
  linkedConditionIds: z.array(z.string()).max(32),
  linkedCalculationIds: z.array(z.string()).max(32),
  linkedSourceIds: z.array(z.string()).max(32),
  blockerIds: z.array(z.string()).max(32).optional(),
  dependsOnModuleIds: z.array(z.string()).max(16).optional(),
  geometryHint: z.string().optional(),
  positionHint: engineeringPositionHintSchema,
  gapOrders: z.number().min(0).max(100).optional(),
}).passthrough();

export const engineeringModelSchema = z.object({
  materiality: engineeringMaterialitySchema,
  artifactClass: engineeringArtifactClassSchema,
  artifactLabel: z.string().min(1).max(160),
  artifactName: z.string().min(1).max(180),
  summary: z.string().min(1).max(900),
  engineeringIntent: z.string().min(1).max(700),
  physicalModules: z.array(engineeringPhysicalModuleSchema).min(1).max(18),
  researchOverlays: z.array(engineeringResearchOverlaySchema).max(80),
  geometryPlan: engineeringGeometryPlanSchema,
  interfaces: z.array(z.object({
    fromModuleId: z.string().min(1).max(80),
    toModuleId: z.string().min(1).max(80),
    type: engineeringInterfaceTypeSchema,
  }).strict()).max(48),
  metrics: z.array(z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(120),
    value: z.number(),
    unit: z.string().max(32).optional(),
    status: engineeringMetricStatusSchema,
  }).strict()).min(1).max(12),
  charts: z.array(z.object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(160),
    type: engineeringChartTypeSchema,
    data: z.array(z.object({label: z.string().min(1).max(120), value: z.number()}).strict()).min(1).max(20),
  }).strict()).max(8),
  nextEngineeringStep: z.string().min(1).max(700),
  modules: z.array(legacyEngineeringModuleSchema).optional(),
}).strict();

export type CanonicalEngineeringModel = z.infer<typeof engineeringModelSchema>;
export type CanonicalEngineeringPhysicalModule = z.infer<typeof engineeringPhysicalModuleSchema>;
export type CanonicalEngineeringResearchOverlay = z.infer<typeof engineeringResearchOverlaySchema>;
export type CanonicalEngineeringGeometryPlan = z.infer<typeof engineeringGeometryPlanSchema>;
export type CanonicalEngineeringGeometryPrimitive = z.infer<typeof engineeringGeometryPrimitiveSchema>;
export type EngineeringPhysicalCategory = z.infer<typeof engineeringPhysicalCategorySchema>;
export type EngineeringPhysicalGeometryHint = z.infer<typeof engineeringPhysicalGeometryHintSchema>;
export type EngineeringPositionHint = z.infer<typeof engineeringPositionHintSchema>;
export type EngineeringSeverity = z.infer<typeof engineeringSeveritySchema>;
export type EngineeringGeometryMaterialRole = z.infer<typeof engineeringGeometryMaterialRoleSchema>;
export type EngineeringGeometryShape = z.infer<typeof engineeringGeometryShapeSchema>;
export type Vector3Tuple = z.infer<typeof vector3Schema>;

export function parseEngineeringModel(value: unknown): CanonicalEngineeringModel | null {
  const parsed = engineeringModelSchema.safeParse(withFallbackGeometryPlan(value));
  if (parsed.success) return normalizeReferences(parsed.data);

  const legacy = legacyToCurrent(value);
  const legacyParsed = engineeringModelSchema.safeParse(legacy);
  return legacyParsed.success ? normalizeReferences(legacyParsed.data) : null;
}

export function isRenderableEngineeringModel(value: unknown): value is CanonicalEngineeringModel {
  const model = parseEngineeringModel(value);
  if (!model) return false;
  const ids = new Set(model.physicalModules.map(module => module.id));
  const primitiveIds = new Set(model.geometryPlan.primitives.map(primitive => primitive.id));
  return model.interfaces.every(link => ids.has(link.fromModuleId) && ids.has(link.toModuleId))
    && model.researchOverlays.every(overlay => ids.has(overlay.linkedModuleId))
    && model.geometryPlan.primitives.every(primitive => ids.has(primitive.moduleId))
    && model.geometryPlan.connectors.every(connector => primitiveIds.has(connector.fromPrimitiveId) && primitiveIds.has(connector.toPrimitiveId));
}

function normalizeReferences(model: CanonicalEngineeringModel): CanonicalEngineeringModel {
  const ids = new Set(model.physicalModules.map(module => module.id));
  const primitives = model.geometryPlan.primitives.filter(primitive => ids.has(primitive.moduleId));
  const primitiveIds = new Set(primitives.map(primitive => primitive.id));
  return {
    ...model,
    interfaces: model.interfaces.filter(link => ids.has(link.fromModuleId) && ids.has(link.toModuleId) && link.fromModuleId !== link.toModuleId),
    researchOverlays: model.researchOverlays.filter(overlay => ids.has(overlay.linkedModuleId)),
    geometryPlan: {
      ...model.geometryPlan,
      primitives,
      connectors: model.geometryPlan.connectors.filter(connector => primitiveIds.has(connector.fromPrimitiveId) && primitiveIds.has(connector.toPrimitiveId) && connector.fromPrimitiveId !== connector.toPrimitiveId),
    },
  };
}

function withFallbackGeometryPlan(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.geometryPlan && typeof record.geometryPlan === 'object') return value;
  const modules = Array.isArray(record.physicalModules) ? record.physicalModules as Array<Record<string, unknown>> : [];
  if (!modules.length) return value;
  return {...record, geometryPlan: fallbackGeometryPlan(modules)};
}

function legacyToCurrent(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.physicalModules)) return value;
  const modules = Array.isArray(record.modules) ? record.modules as Array<Record<string, unknown>> : [];
  if (!modules.length) return value;

  const physicalModules = modules.map((module, index) => ({
    id: stringValue(module.id, `legacy-${index + 1}`),
    name: stringValue(module.name, `Module ${index + 1}`),
    role: stringValue(module.role, stringValue(module.description, 'Legacy engineering module.')),
    category: legacyCategory(module.category),
    geometryHint: legacyGeometry(module.geometryHint, module.category),
    positionHint: engineeringPositionHintSchema.safeParse(module.positionHint).success ? module.positionHint : 'center',
    feasibilityScore: numberValue(module.feasibilityScore),
    linkedConditionIds: stringArray(module.linkedConditionIds),
    linkedCalculationIds: stringArray(module.linkedCalculationIds),
    linkedSourceIds: stringArray(module.linkedSourceIds),
  }));
  const firstId = physicalModules[0]?.id ?? 'legacy-1';
  const researchOverlays = modules.flatMap(module => [
    ...stringArray(module.blockerIds).map(id => ({id: `legacy-blocker-${id}`, linkedModuleId: stringValue(module.id, firstId), type: 'blocker', title: id, severity: 'critical'})),
    ...(typeof module.gapOrders === 'number' ? [{id: `legacy-gap-${stringValue(module.id, firstId)}`, linkedModuleId: stringValue(module.id, firstId), type: 'calculation', title: 'Order-of-magnitude gap', severity: 'warning', gapOrders: module.gapOrders}] : []),
  ]);

  return {
    ...record,
    artifactLabel: stringValue(record.artifactLabel, stringValue(record.artifactName, 'Engineering model')),
    physicalModules,
    researchOverlays,
    geometryPlan: fallbackGeometryPlan(physicalModules),
  };
}

function fallbackGeometryPlan(modules: Array<Record<string, unknown>>) {
  const positions: Record<string, Vector3Tuple> = {
    center: [0, 0, 0],
    front: [0, .15, -1.6],
    rear: [0, .05, 1.65],
    left: [-1.6, 0, 0],
    right: [1.6, 0, 0],
    top: [0, 1.25, 0],
    bottom: [0, -1.25, 0],
    internal: [0, 0, .1],
    external: [0, .9, 1.15],
  };
  const primitives = modules.map((module, index) => {
    const id = stringValue(module.id, `module-${index + 1}`);
    const positionHint = typeof module.positionHint === 'string' && module.positionHint in positions ? module.positionHint : 'center';
    const base = positions[positionHint];
    return {
      id: `primitive-${id}`,
      moduleId: id,
      shape: primitiveShape(module.geometryHint, module.category),
      position: [base[0] + Math.cos(index * 2.399) * .18, base[1], base[2] + Math.sin(index * 2.399) * .18] as Vector3Tuple,
      rotation: [0, 0, 0] as Vector3Tuple,
      scale: primitiveScale(module.geometryHint, module.category),
      materialRole: primitiveRole(module.category),
      opacity: .76,
    };
  });
  return {
    layout: 'freeform',
    primitives,
    connectors: primitives.slice(1).map(primitive => ({
      fromPrimitiveId: primitives[0].id,
      toPrimitiveId: primitive.id,
      type: 'structural',
    })),
  };
}

function primitiveShape(geometry: unknown, category: unknown): string {
  if (geometry === 'rotor') return 'ring';
  if (geometry === 'thruster') return 'cylinder';
  if (geometry === 'battery_pack' || geometry === 'cell_stack') return 'cell_stack';
  if (geometry === 'sensor_array') return 'sphere';
  if (geometry === 'shield') return 'disc';
  if (geometry === 'wing') return 'wing';
  if (category === 'energy') return 'cell_stack';
  if (category === 'propulsion') return 'cylinder';
  if (category === 'sensor' || category === 'measurement') return 'sphere';
  return 'rounded_box';
}

function primitiveScale(geometry: unknown, category: unknown): Vector3Tuple {
  if (geometry === 'rotor') return [.72, .08, .72];
  if (geometry === 'thruster') return [.28, .75, .28];
  if (geometry === 'cell_stack' || category === 'energy') return [.7, .34, .44];
  if (geometry === 'shield') return [1, .12, 1];
  if (geometry === 'wing') return [1.75, .08, .34];
  if (category === 'sensor' || category === 'measurement') return [.28, .28, .28];
  return [.8, .42, .58];
}

function primitiveRole(category: unknown): string {
  if (category === 'energy') return 'energy';
  if (category === 'thermal') return 'thermal';
  if (category === 'control') return 'control';
  if (category === 'propulsion' || category === 'lift') return 'propulsion';
  if (category === 'sensor' || category === 'measurement') return 'sensor';
  if (category === 'safety') return 'shield';
  if (category === 'body' || category === 'cabin' || category === 'material') return 'structure';
  return 'unknown';
}

function legacyCategory(value: unknown): EngineeringPhysicalCategory {
  const map: Record<string, EngineeringPhysicalCategory> = {
    power: 'energy',
    structure: 'body',
    control: 'control',
    thermal: 'thermal',
    propulsion: 'propulsion',
    material: 'material',
    sensor: 'sensor',
    safety: 'safety',
    measurement: 'measurement',
  };
  return typeof value === 'string' ? map[value] ?? 'unknown' : 'unknown';
}

function legacyGeometry(geometry: unknown, category: unknown): EngineeringPhysicalGeometryHint {
  if (typeof geometry === 'string') {
    const direct = engineeringPhysicalGeometryHintSchema.safeParse(geometry);
    if (direct.success) return direct.data;
  }
  const categoryValue = legacyCategory(category);
  const map: Record<EngineeringPhysicalCategory, EngineeringPhysicalGeometryHint> = {
    body: 'body',
    cabin: 'cabin',
    lift: 'wing',
    propulsion: 'thruster',
    energy: 'battery_pack',
    control: 'control_core',
    thermal: 'heat_sink',
    safety: 'shield',
    sensor: 'sensor_array',
    material: 'frame',
    measurement: 'sensor_array',
    unknown: 'generic',
  };
  return map[categoryValue];
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
