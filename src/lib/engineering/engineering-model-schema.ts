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
export type EngineeringPhysicalCategory = z.infer<typeof engineeringPhysicalCategorySchema>;
export type EngineeringPhysicalGeometryHint = z.infer<typeof engineeringPhysicalGeometryHintSchema>;
export type EngineeringPositionHint = z.infer<typeof engineeringPositionHintSchema>;
export type EngineeringSeverity = z.infer<typeof engineeringSeveritySchema>;

export function parseEngineeringModel(value: unknown): CanonicalEngineeringModel | null {
  const parsed = engineeringModelSchema.safeParse(value);
  if (parsed.success) return normalizeReferences(parsed.data);

  const legacy = legacyToCurrent(value);
  const legacyParsed = engineeringModelSchema.safeParse(legacy);
  return legacyParsed.success ? normalizeReferences(legacyParsed.data) : null;
}

export function isRenderableEngineeringModel(value: unknown): value is CanonicalEngineeringModel {
  const model = parseEngineeringModel(value);
  if (!model) return false;
  const ids = new Set(model.physicalModules.map(module => module.id));
  return model.interfaces.every(link => ids.has(link.fromModuleId) && ids.has(link.toModuleId))
    && model.researchOverlays.every(overlay => ids.has(overlay.linkedModuleId));
}

function normalizeReferences(model: CanonicalEngineeringModel): CanonicalEngineeringModel {
  const ids = new Set(model.physicalModules.map(module => module.id));
  return {
    ...model,
    interfaces: model.interfaces.filter(link => ids.has(link.fromModuleId) && ids.has(link.toModuleId) && link.fromModuleId !== link.toModuleId),
    researchOverlays: model.researchOverlays.filter(overlay => ids.has(overlay.linkedModuleId)),
  };
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
  };
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
