import type {
  CanonicalEngineeringModel,
  CanonicalEngineeringModule,
  EngineeringModuleCategory,
} from '@/lib/engineering/engineering-model-schema';

export type EngineeringSeverity = 'info' | 'success' | 'warning' | 'critical';
export type Vector3Tuple = [number, number, number];

export type EngineeringRenderModule = CanonicalEngineeringModule & {
  color: string;
  severity: EngineeringSeverity;
  position: Vector3Tuple;
  explodedPosition: Vector3Tuple;
  scale: Vector3Tuple;
};

const CATEGORY_COLORS: Record<EngineeringModuleCategory, string> = {
  power: '#f4bf4f',
  structure: '#35d5d0',
  control: '#55b9ff',
  thermal: '#ff765f',
  propulsion: '#45e0b7',
  material: '#9dd66f',
  sensor: '#a58cff',
  safety: '#fb7185',
  measurement: '#67e8f9',
  unknown: '#94a3b8',
};

const POSITION_BASE: Record<CanonicalEngineeringModule['positionHint'], Vector3Tuple> = {
  center: [0, 0, 0],
  top: [0, 1.6, 0],
  bottom: [0, -1.6, 0],
  left: [-1.8, 0, 0],
  right: [1.8, 0, 0],
  front: [0, 0, -1.65],
  rear: [0, 0, 1.65],
  internal: [0, .15, .2],
  external: [0, 1.1, 1.45],
};

export function buildEngineeringRenderModules(model: CanonicalEngineeringModel): EngineeringRenderModule[] {
  const hintCounts = new Map<string, number>();
  return model.modules.slice(0, 16).map((module, index) => {
    const occurrence = hintCounts.get(module.positionHint) ?? 0;
    hintCounts.set(module.positionHint, occurrence + 1);
    const base = POSITION_BASE[module.positionHint];
    const orbit = occurrence * .62;
    const angle = index * 2.399;
    const position: Vector3Tuple = [
      base[0] + Math.cos(angle) * orbit,
      base[1] + (occurrence % 2 ? .28 : -.16) * occurrence,
      base[2] + Math.sin(angle) * orbit,
    ];
    const outward = normalize(position[0], position[1], position[2]);
    const explodedPosition: Vector3Tuple = [
      position[0] + outward[0] * (1.25 + occurrence * .2),
      position[1] + outward[1] * (1.25 + occurrence * .2),
      position[2] + outward[2] * (1.25 + occurrence * .2),
    ];

    return {
      ...module,
      color: CATEGORY_COLORS[module.category],
      severity: moduleSeverity(module),
      position,
      explodedPosition,
      scale: geometryScale(module),
    };
  });
}

export function engineeringCategoryColor(category: EngineeringModuleCategory): string {
  return CATEGORY_COLORS[category];
}

function moduleSeverity(module: CanonicalEngineeringModule): EngineeringSeverity {
  if (module.priority === 'critical' || module.feasibilityScore < 20) return 'critical';
  if (module.priority === 'high' || module.feasibilityScore < 50) return 'warning';
  if (module.feasibilityScore >= 70) return 'success';
  return 'info';
}

function geometryScale(module: CanonicalEngineeringModule): Vector3Tuple {
  const priorityScale = {low: .82, medium: 1, high: 1.12, critical: 1.22}[module.priority];
  const scales: Record<CanonicalEngineeringModule['geometryHint'], Vector3Tuple> = {
    core: [.72, .72, .72],
    shell: [1.18, .82, .82],
    ring: [.84, .18, .84],
    panel: [1.05, .58, .18],
    arm: [.22, 1.15, .22],
    leg: [.28, 1.35, .28],
    rotor: [.92, .12, .92],
    tank: [.55, 1.15, .55],
    cell: [.28, .92, .28],
    probe: [.18, .95, .18],
    block: [.82, .62, .72],
    tube: [.48, 1.25, .48],
    unknown: [.72, .72, .72],
  };
  const base = scales[module.geometryHint];
  return [base[0] * priorityScale, base[1] * priorityScale, base[2] * priorityScale];
}

function normalize(x: number, y: number, z: number): Vector3Tuple {
  const length = Math.hypot(x, y, z) || 1;
  if (length === 1 && x === 0 && y === 0 && z === 0) return [0, 1, 0];
  return [x / length, y / length, z / length];
}
