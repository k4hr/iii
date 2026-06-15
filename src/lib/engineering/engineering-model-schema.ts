import {z} from 'zod';

export const engineeringMaterialitySchema = z.enum(['material', 'abstract', 'hybrid']);
export const engineeringArtifactClassSchema = z.enum([
  'device', 'vehicle', 'wearable', 'battery', 'reactor', 'propulsion', 'sensor', 'material_system', 'infrastructure', 'unknown',
]);
export const engineeringModuleCategorySchema = z.enum([
  'power', 'structure', 'control', 'thermal', 'propulsion', 'material', 'sensor', 'safety', 'measurement', 'unknown',
]);
export const engineeringPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const engineeringGeometryHintSchema = z.enum([
  'core', 'shell', 'ring', 'panel', 'arm', 'leg', 'rotor', 'tank', 'cell', 'probe', 'block', 'tube', 'unknown',
]);
export const engineeringPositionHintSchema = z.enum([
  'center', 'top', 'bottom', 'left', 'right', 'front', 'rear', 'internal', 'external',
]);
export const engineeringInterfaceTypeSchema = z.enum(['energy', 'control', 'heat', 'material_flow', 'signal', 'structural']);
export const engineeringMetricStatusSchema = z.enum(['ok', 'warning', 'critical']);
export const engineeringChartTypeSchema = z.enum(['energy_gap', 'mass_budget', 'thermal_load', 'testability', 'feasibility']);

export const engineeringModuleSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  role: z.string().min(1).max(220),
  description: z.string().min(1).max(700),
  category: engineeringModuleCategorySchema,
  priority: engineeringPrioritySchema,
  feasibilityScore: z.number().min(0).max(100),
  linkedConditionIds: z.array(z.string()).max(24),
  linkedCalculationIds: z.array(z.string()).max(24),
  linkedSourceIds: z.array(z.string()).max(24),
  blockerIds: z.array(z.string()).max(24),
  dependsOnModuleIds: z.array(z.string()).max(16),
  geometryHint: engineeringGeometryHintSchema,
  positionHint: engineeringPositionHintSchema,
  gapOrders: z.number().min(0).max(100).optional(),
}).strict();

export const engineeringModelSchema = z.object({
  materiality: engineeringMaterialitySchema,
  artifactClass: engineeringArtifactClassSchema,
  artifactName: z.string().min(1).max(180),
  summary: z.string().min(1).max(900),
  engineeringIntent: z.string().min(1).max(700),
  modules: z.array(engineeringModuleSchema).min(2).max(16),
  interfaces: z.array(z.object({
    fromModuleId: z.string().min(1).max(80),
    toModuleId: z.string().min(1).max(80),
    type: engineeringInterfaceTypeSchema,
  }).strict()).max(40),
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
}).strict();

export type CanonicalEngineeringModel = z.infer<typeof engineeringModelSchema>;
export type CanonicalEngineeringModule = z.infer<typeof engineeringModuleSchema>;
export type EngineeringModuleCategory = z.infer<typeof engineeringModuleCategorySchema>;
export type EngineeringGeometryHint = z.infer<typeof engineeringGeometryHintSchema>;
export type EngineeringPositionHint = z.infer<typeof engineeringPositionHintSchema>;

export function parseEngineeringModel(value: unknown): CanonicalEngineeringModel | null {
  const parsed = engineeringModelSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isRenderableEngineeringModel(value: unknown): value is CanonicalEngineeringModel {
  const model = parseEngineeringModel(value);
  if (!model) return false;
  const ids = new Set(model.modules.map(module => module.id));
  return model.interfaces.every(link => ids.has(link.fromModuleId) && ids.has(link.toModuleId));
}
