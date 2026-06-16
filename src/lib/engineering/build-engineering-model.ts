import type {
  CanonicalEngineeringModel,
  CanonicalEngineeringPhysicalModule,
  CanonicalEngineeringResearchOverlay,
  CanonicalEngineeringGeometryPrimitive,
  EngineeringPhysicalCategory,
  EngineeringPhysicalGeometryHint,
  EngineeringGeometryMaterialRole,
  EngineeringSeverity,
  Vector3Tuple,
} from '@/lib/engineering/engineering-model-schema';

export type EngineeringRenderModule = CanonicalEngineeringPhysicalModule & {
  color: string;
  severity: EngineeringSeverity;
  position: Vector3Tuple;
  explodedPosition: Vector3Tuple;
  scale: Vector3Tuple;
  overlays: CanonicalEngineeringResearchOverlay[];
};

export type EngineeringRenderPrimitive = CanonicalEngineeringGeometryPrimitive & {
  color: string;
  module: EngineeringRenderModule;
  explodedPosition: Vector3Tuple;
};

const CATEGORY_COLORS: Record<EngineeringPhysicalCategory, string> = {
  body: '#35d5d0',
  cabin: '#55b9ff',
  lift: '#45e0b7',
  propulsion: '#ff765f',
  energy: '#f4bf4f',
  control: '#a58cff',
  thermal: '#fb923c',
  safety: '#fb7185',
  sensor: '#67e8f9',
  material: '#9dd66f',
  measurement: '#c4b5fd',
  unknown: '#94a3b8',
};

const POSITION_BASE: Record<CanonicalEngineeringPhysicalModule['positionHint'], Vector3Tuple> = {
  center: [0, 0, 0],
  front: [0, .12, -1.7],
  rear: [0, .05, 1.85],
  left: [-1.85, 0, 0],
  right: [1.85, 0, 0],
  top: [0, 1.35, 0],
  bottom: [0, -1.45, 0],
  internal: [0, 0, .15],
  external: [0, .95, 1.25],
};

export function buildEngineeringRenderModules(model: CanonicalEngineeringModel): EngineeringRenderModule[] {
  const hintCounts = new Map<string, number>();
  const physicalModules = model.physicalModules.length ? model.physicalModules : [];
  return physicalModules.slice(0, 18).map((module, index) => {
    const primitiveCenter = modulePrimitiveCenter(model, module.id);
    const position = primitiveCenter ?? fallbackModulePosition(module, index, hintCounts);
    const outward = normalize(position[0], position[1], position[2]);
    const explodedPosition: Vector3Tuple = [
      position[0] + outward[0] * 1.15,
      position[1] + outward[1] * 1.15,
      position[2] + outward[2] * 1.15,
    ];
    const overlays = model.researchOverlays.filter(overlay => overlay.linkedModuleId === module.id);

    return {
      ...module,
      color: CATEGORY_COLORS[module.category],
      severity: moduleSeverity(module, overlays),
      position,
      explodedPosition,
      scale: geometryScale(module.geometryHint),
      overlays,
    };
  });
}

export function engineeringCategoryColor(category: EngineeringPhysicalCategory): string {
  return CATEGORY_COLORS[category];
}

export function engineeringMaterialRoleColor(role: EngineeringGeometryMaterialRole): string {
  const colors: Record<EngineeringGeometryMaterialRole, string> = {
    body: '#35d5d0',
    glass: '#7dd3fc',
    energy: '#f4bf4f',
    thermal: '#fb923c',
    control: '#a58cff',
    propulsion: '#ff765f',
    sensor: '#67e8f9',
    shield: '#fb7185',
    structure: '#9dd66f',
    unknown: '#94a3b8',
  };
  return colors[role];
}

export function buildEngineeringRenderPrimitives(model: CanonicalEngineeringModel): EngineeringRenderPrimitive[] {
  const modules = buildEngineeringRenderModules(model);
  const moduleMap = new Map(modules.map(module => [module.id, module]));
  return model.geometryPlan.primitives
    .filter(primitive => moduleMap.has(primitive.moduleId))
    .map(primitive => {
      const module = moduleMap.get(primitive.moduleId)!;
      const outward = normalize(primitive.position[0], primitive.position[1], primitive.position[2]);
      return {
        ...primitive,
        color: engineeringMaterialRoleColor(primitive.materialRole),
        module,
        explodedPosition: [
          primitive.position[0] + outward[0] * 1.15,
          primitive.position[1] + outward[1] * 1.15,
          primitive.position[2] + outward[2] * 1.15,
        ],
      };
    });
}

function moduleSeverity(module: CanonicalEngineeringPhysicalModule, overlays: CanonicalEngineeringResearchOverlay[]): EngineeringSeverity {
  if (overlays.some(overlay => overlay.severity === 'critical') || module.feasibilityScore < 20) return 'critical';
  if (overlays.some(overlay => overlay.severity === 'warning') || module.feasibilityScore < 50) return 'warning';
  if (module.feasibilityScore >= 70) return 'success';
  return 'info';
}

function geometryScale(hint: EngineeringPhysicalGeometryHint): Vector3Tuple {
  const scales: Record<EngineeringPhysicalGeometryHint, Vector3Tuple> = {
    body: [1.65, .48, .82],
    cabin: [.72, .42, .62],
    wing: [1.9, .12, .48],
    rotor: [.82, .12, .82],
    thruster: [.42, .8, .42],
    battery_pack: [.92, .38, .55],
    control_core: [.58, .36, .42],
    heat_sink: [.88, .18, .46],
    sensor_array: [.42, .32, .32],
    shield: [1.15, .42, .72],
    frame: [.9, .7, .52],
    cell_stack: [.38, 1, .38],
    generic: [.72, .72, .72],
  };
  return scales[hint];
}

function modulePrimitiveCenter(model: CanonicalEngineeringModel, moduleId: string): Vector3Tuple | null {
  const primitives = model.geometryPlan.primitives.filter(primitive => primitive.moduleId === moduleId);
  if (!primitives.length) return null;
  return [
    primitives.reduce((sum, primitive) => sum + primitive.position[0], 0) / primitives.length,
    primitives.reduce((sum, primitive) => sum + primitive.position[1], 0) / primitives.length,
    primitives.reduce((sum, primitive) => sum + primitive.position[2], 0) / primitives.length,
  ];
}

function fallbackModulePosition(module: CanonicalEngineeringPhysicalModule, index: number, hintCounts: Map<string, number>): Vector3Tuple {
  const occurrence = hintCounts.get(module.positionHint) ?? 0;
  hintCounts.set(module.positionHint, occurrence + 1);
  const base = POSITION_BASE[module.positionHint];
  const orbit = occurrence * .48;
  const angle = index * 2.399;
  return [
    base[0] + Math.cos(angle) * orbit,
    base[1] + (occurrence % 2 ? .22 : -.12) * occurrence,
    base[2] + Math.sin(angle) * orbit,
  ];
}

function normalize(x: number, y: number, z: number): Vector3Tuple {
  const length = Math.hypot(x, y, z);
  if (!length) return [0, 1, 0];
  return [x / length, y / length, z / length];
}
