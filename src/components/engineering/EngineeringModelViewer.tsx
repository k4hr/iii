'use client';

import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Edges, Grid, Html, Line, OrbitControls, useCursor} from '@react-three/drei';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import type {CanonicalEngineeringGeometryPrimitive, CanonicalEngineeringModel, EngineeringGeometryMaterialRole, EngineeringSeverity, Vector3Tuple} from '@/lib/engineering/engineering-model-schema';
import {buildEngineeringRenderModules, buildEngineeringRenderPrimitives, type EngineeringRenderModule, type EngineeringRenderPrimitive} from '@/lib/engineering/build-engineering-model';

type EngineeringModelViewerProps = {
  model: CanonicalEngineeringModel;
  selectedModuleId: string;
  exploded: boolean;
  resetSignal: number;
  onSelectModule: (moduleId: string) => void;
};

type ModuleAssembly = {
  module: EngineeringRenderModule;
  primitives: EngineeringRenderPrimitive[];
};

export function EngineeringModelViewer({model, selectedModuleId, exploded, resetSignal, onSelectModule}: EngineeringModelViewerProps) {
  const modules = useMemo(() => buildEngineeringRenderModules(model), [model]);
  const primitives = useMemo(() => buildEngineeringRenderPrimitives(model), [model]);
  const assemblies = useMemo(() => buildAssemblies(modules, primitives), [modules, primitives]);
  const primitiveMap = useMemo(() => new Map(primitives.map(primitive => [primitive.id, primitive])), [primitives]);

  return (
    <div className="relative h-[430px] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_42%,rgba(27,209,201,.09),transparent_42%),linear-gradient(180deg,#030a0c,#010405)] sm:h-[560px]">
      <Canvas camera={{position: [6, 4, 7], fov: 42, near: .1, far: 100}} dpr={[1, 1.5]} gl={{antialias: true, alpha: true}}>
        <color attach="background" args={['#020708']} />
        <fog attach="fog" args={['#020708', 10, 24]} />
        <ambientLight intensity={.72} />
        <directionalLight color="#8ffcf0" intensity={2.6} position={[5, 7, 5]} />
        <pointLight color="#38bdf8" intensity={22} position={[-4, 1, 3]} distance={10} />
        <pointLight color="#34d399" intensity={12} position={[4, -2, -2]} distance={9} />

        <group rotation={[0, -.35, 0]}>
          {model.geometryPlan.connectors.map((connector, index) => {
            const from = primitiveMap.get(connector.fromPrimitiveId);
            const to = primitiveMap.get(connector.toPrimitiveId);
            if (!from || !to) return null;
            return <PrimitiveConnector exploded={exploded} from={from} key={`${connector.fromPrimitiveId}:${connector.toPrimitiveId}:${index}`} to={to} type={connector.type} />;
          })}
          {assemblies.map(assembly => (
            <ModuleAssemblyMesh
              assembly={assembly}
              exploded={exploded}
              key={assembly.module.id}
              onSelect={onSelectModule}
              selected={selectedModuleId === assembly.module.id}
            />
          ))}
        </group>

        <Grid args={[24, 24]} cellColor="#154a4c" cellSize={.5} cellThickness={.42} fadeDistance={15} fadeStrength={1.7} position={[0, -2.65, 0]} sectionColor="#2a8d8d" sectionSize={2} sectionThickness={.78} />
        <axesHelper args={[2.4]} position={[-3.7, -2.55, -2.2]} />
        <CameraRig resetSignal={resetSignal} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-100/[0.08] shadow-[inset_0_0_80px_rgba(18,204,194,.04)]" />
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[8px] tracking-[.18em] text-cyan-100/35 uppercase">GEOMETRY PLAN / MODULE ASSEMBLY RENDER</div>
      <div className="pointer-events-none absolute bottom-4 right-4 text-right font-mono text-[8px] leading-4 tracking-[.12em] text-cyan-100/30 uppercase">layout: {model.geometryPlan.layout}<br />drag rotate / wheel zoom / shift pan</div>
    </div>
  );
}

function ModuleAssemblyMesh({assembly, selected, exploded, onSelect}: {assembly: ModuleAssembly; selected: boolean; exploded: boolean; onSelect: (id: string) => void}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const target = useMemo(() => new THREE.Vector3(...(exploded ? assembly.module.explodedPosition : assembly.module.position)), [assembly.module.explodedPosition, assembly.module.position, exploded]);
  const targetScale = selected ? 1.045 : hovered ? 1.02 : 1;
  useCursor(hovered);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(target, 1 - Math.exp(-delta * 6.5));
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-delta * 8));
  });

  return (
    <group
      onClick={event => { event.stopPropagation(); onSelect(assembly.module.id); }}
      onPointerOut={event => { event.stopPropagation(); setHovered(false); }}
      onPointerOver={event => { event.stopPropagation(); setHovered(true); }}
      position={assembly.module.position}
      ref={groupRef}
    >
      {selected && <SelectionHalo module={assembly.module} />}
      {assembly.primitives.map(primitive => (
        <PrimitiveShape
          highlighted={selected || hovered}
          key={primitive.id}
          primitive={primitive}
          relativePosition={subtract(primitive.position, assembly.module.position)}
        />
      ))}
      <ModuleStatus module={assembly.module} selected={selected || hovered} />
      {selected && <OverlayBeacons module={assembly.module} />}
      {(selected || hovered) && <ModuleLabel module={assembly.module} />}
    </group>
  );
}

function PrimitiveShape({primitive, highlighted, relativePosition}: {primitive: EngineeringRenderPrimitive; highlighted: boolean; relativePosition: Vector3Tuple}) {
  const material = materialStyle(primitive.materialRole, primitive.color, highlighted, primitive.opacity);
  if (primitive.shape === 'cell_stack') {
    return (
      <group position={relativePosition} rotation={primitive.rotation}>
        <PrimitivePart material={material} position={[0, 0, 0]} scale={[primitive.scale[0] * 1.12, primitive.scale[1] * .86, primitive.scale[2] * 1.08]} shape="rounded_box" />
        {[-.34, 0, .34].map((x, column) => [-.24, .24].map((z, row) => (
          <PrimitivePart material={materialStyle('energy', '#f4bf4f', highlighted, .78)} key={`${column}:${row}`} position={[x * primitive.scale[0], primitive.scale[1] * .12, z * primitive.scale[2]]} scale={[primitive.scale[0] * .2, primitive.scale[1] * 1.15, primitive.scale[2] * .22]} shape="cylinder" />
        )))}
      </group>
    );
  }
  if (primitive.shape === 'lattice') {
    return (
      <group position={relativePosition} rotation={primitive.rotation}>
        <PrimitivePart material={material} position={[0, 0, 0]} scale={[primitive.scale[0], primitive.scale[1] * .16, primitive.scale[2]]} shape="box" />
        {[-.48, -.24, 0, .24, .48].map((x, index) => <PrimitivePart key={index} material={material} position={[x * primitive.scale[0], primitive.scale[1] * .25, 0]} scale={[primitive.scale[0] * .055, primitive.scale[1], primitive.scale[2]]} shape="box" />)}
      </group>
    );
  }
  if (primitive.shape === 'curved_blade') {
    return (
      <group position={relativePosition} rotation={primitive.rotation}>
        <PrimitivePart material={material} position={[-primitive.scale[0] * .12, 0, 0]} scale={[primitive.scale[0], primitive.scale[1], primitive.scale[2]]} shape="rounded_box" />
        <PrimitivePart material={material} position={[primitive.scale[0] * .5, 0, primitive.scale[2] * .24]} scale={[primitive.scale[0] * .42, primitive.scale[1] * .95, primitive.scale[2] * .72]} shape="cone" />
      </group>
    );
  }
  if (primitive.shape === 'ring') {
    return (
      <group position={relativePosition} rotation={primitive.rotation}>
        <PrimitivePart material={material} position={[0, 0, 0]} scale={primitive.scale} shape="ring" />
        <PrimitivePart material={materialStyle('structure', '#83f4e8', highlighted, .58)} position={[0, 0, 0]} scale={[primitive.scale[0] * 1.62, primitive.scale[1] * .35, primitive.scale[2] * .08]} shape="box" />
        <PrimitivePart material={materialStyle('structure', '#83f4e8', highlighted, .58)} position={[0, 0, 0]} scale={[primitive.scale[0] * .08, primitive.scale[1] * .35, primitive.scale[2] * 1.62]} shape="box" />
      </group>
    );
  }
  if (primitive.shape === 'rounded_box') {
    return (
      <group position={relativePosition} rotation={primitive.rotation}>
        <PrimitivePart material={material} position={[0, 0, 0]} scale={primitive.scale} shape="rounded_box" />
        {primitive.materialRole === 'body' && <PrimitivePart material={materialStyle('structure', primitive.color, highlighted, .18, true)} position={[0, .02, 0]} scale={[primitive.scale[0] * 1.04, primitive.scale[1] * 1.08, primitive.scale[2] * 1.04]} shape="rounded_box" />}
      </group>
    );
  }
  return <PrimitivePart material={material} position={relativePosition} rotation={primitive.rotation} scale={primitive.scale} shape={primitive.shape} />;
}

function PrimitivePart({shape, position, scale, material, rotation}: {shape: CanonicalEngineeringGeometryPrimitive['shape'] | 'box'; position: Vector3Tuple; scale: Vector3Tuple; material: RenderMaterial; rotation?: Vector3Tuple}) {
  return (
    <mesh castShadow position={position} rotation={rotation ?? [0, 0, 0]} scale={shape === 'sphere' || shape === 'capsule' ? scale : [1, 1, 1]}>
      <PrimitiveGeometry scale={scale} shape={shape} />
      <meshStandardMaterial color={material.color} emissive={material.color} emissiveIntensity={material.emissiveIntensity} metalness={material.metalness} opacity={material.opacity} roughness={material.roughness} transparent wireframe={material.wireframe} />
      <Edges color={material.edgeColor} lineWidth={material.edgeWidth} threshold={12} />
    </mesh>
  );
}

function PrimitiveGeometry({shape, scale}: {shape: CanonicalEngineeringGeometryPrimitive['shape'] | 'box'; scale: Vector3Tuple}) {
  if (shape === 'sphere') return <sphereGeometry args={[1, 30, 18]} />;
  if (shape === 'capsule') return <capsuleGeometry args={[1, 1.18, 12, 24]} />;
  if (shape === 'cylinder' || shape === 'tube') return <cylinderGeometry args={[scale[0], scale[0] * .82, scale[1], 28, 2]} />;
  if (shape === 'cone') return <coneGeometry args={[scale[0], scale[1], 28]} />;
  if (shape === 'torus' || shape === 'ring') return <torusGeometry args={[scale[0], Math.max(.025, scale[1]), 12, 48]} />;
  if (shape === 'disc') return <cylinderGeometry args={[scale[0], scale[0], Math.max(.025, scale[1]), 54, 1]} />;
  if (shape === 'wing') return <boxGeometry args={[scale[0] * 2.25, scale[1], scale[2]]} />;
  if (shape === 'panel') return <boxGeometry args={[scale[0], Math.max(.025, scale[1]), scale[2]]} />;
  return <boxGeometry args={scale} />;
}

function PrimitiveConnector({from, to, type, exploded}: {from: EngineeringRenderPrimitive; to: EngineeringRenderPrimitive; type: CanonicalEngineeringModel['geometryPlan']['connectors'][number]['type']; exploded: boolean}) {
  const colors = {energy: '#f4bf4f', signal: '#55b9ff', heat: '#ff765f', material_flow: '#9dd66f', force: '#fb7185', structural: '#35d5d0'};
  const points = [primitiveWorldPosition(from, exploded), primitiveWorldPosition(to, exploded)];
  return <Line color={colors[type]} dashed lineWidth={.55} opacity={.26} points={points} transparent />;
}

function SelectionHalo({module}: {module: EngineeringRenderModule}) {
  const radius = Math.max(.38, module.scale[0] + module.scale[2] * .5);
  return (
    <group>
      <mesh position={[0, .02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, .012, 8, 56]} />
        <meshBasicMaterial color="#d9fffb" transparent opacity={.72} />
      </mesh>
      <pointLight color={module.color} distance={3.6} intensity={3.2} />
    </group>
  );
}

function ModuleStatus({module, selected}: {module: EngineeringRenderModule; selected: boolean}) {
  const color = {info: '#5eead4', success: '#4ade80', warning: '#fbbf24', critical: '#fb7185'}[module.severity];
  if (!selected && module.severity !== 'critical') return null;
  return (
    <mesh position={[0, module.scale[1] + .36, 0]}>
      <sphereGeometry args={[selected ? .065 : .045, 12, 8]} />
      <meshBasicMaterial color={color} transparent opacity={selected ? .95 : .62} />
      <pointLight color={color} distance={1.4} intensity={selected ? 2.2 : .8} />
    </mesh>
  );
}

function OverlayBeacons({module}: {module: EngineeringRenderModule}) {
  const visible = module.overlays.filter(overlay => overlay.severity === 'critical' || overlay.severity === 'warning').slice(0, 3);
  if (!visible.length) return null;
  return (
    <group>
      {visible.map((overlay, index) => {
        const angle = -0.75 + index * .75;
        const color = overlayColor(overlay.severity);
        return (
          <mesh key={overlay.id} position={[Math.cos(angle) * (module.scale[0] + .22), module.scale[1] + .16, Math.sin(angle) * (module.scale[2] + .22)]}>
            <sphereGeometry args={[.038, 10, 8]} />
            <meshBasicMaterial color={color} />
            <pointLight color={color} distance={1} intensity={1.1} />
          </mesh>
        );
      })}
    </group>
  );
}

function ModuleLabel({module}: {module: EngineeringRenderModule}) {
  return (
    <Html center position={[0, module.scale[1] + .62, 0]} style={{pointerEvents: 'none'}} transform={false}>
      <div className="whitespace-nowrap rounded border border-cyan-100/20 bg-[#02090b]/90 px-2 py-1 font-mono text-[8px] tracking-[.08em] text-cyan-50/80 uppercase shadow-[0_0_18px_rgba(34,211,201,.14)] backdrop-blur-md">
        {module.name} / {module.feasibilityScore}% / {module.overlays.length} overlays
      </div>
    </Html>
  );
}

type RenderMaterial = {
  color: string;
  edgeColor: string;
  edgeWidth: number;
  emissiveIntensity: number;
  metalness: number;
  opacity: number;
  roughness: number;
  wireframe?: boolean;
};

function materialStyle(role: EngineeringGeometryMaterialRole, color: string, highlighted: boolean, opacity?: number, wireframe = false): RenderMaterial {
  const baseOpacity: Record<EngineeringGeometryMaterialRole, number> = {
    body: .64,
    glass: .42,
    energy: .76,
    thermal: .66,
    control: .76,
    propulsion: .7,
    sensor: .82,
    shield: .5,
    structure: .58,
    unknown: .58,
  };
  return {
    color,
    edgeColor: highlighted ? '#e5fffc' : role === 'glass' ? '#c8f7ff' : color,
    edgeWidth: highlighted ? 1.55 : .62,
    emissiveIntensity: highlighted ? .28 : role === 'energy' || role === 'propulsion' ? .14 : .07,
    metalness: role === 'glass' ? .18 : .68,
    opacity: opacity ?? (highlighted ? Math.min(.94, baseOpacity[role] + .12) : baseOpacity[role]),
    roughness: role === 'glass' ? .06 : .25,
    wireframe,
  };
}

function primitiveWorldPosition(primitive: EngineeringRenderPrimitive, exploded: boolean): Vector3Tuple {
  const modulePosition = exploded ? primitive.module.explodedPosition : primitive.module.position;
  const local = subtract(primitive.position, primitive.module.position);
  return [modulePosition[0] + local[0], modulePosition[1] + local[1], modulePosition[2] + local[2]];
}

function buildAssemblies(modules: EngineeringRenderModule[], primitives: EngineeringRenderPrimitive[]): ModuleAssembly[] {
  return modules.map(module => ({
    module,
    primitives: primitives.filter(primitive => primitive.moduleId === module.id),
  })).filter(assembly => assembly.primitives.length);
}

function subtract(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function overlayColor(severity: EngineeringSeverity): string {
  return {info: '#67e8f9', success: '#4ade80', warning: '#fbbf24', critical: '#fb7185'}[severity];
}

function CameraRig({resetSignal}: {resetSignal: number}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const {camera} = useThree();
  useEffect(() => {
    camera.position.set(6, 4, 7);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, resetSignal]);
  return <OrbitControls ref={controlsRef} enableDamping maxDistance={16} minDistance={4.2} panSpeed={.65} rotateSpeed={.62} />;
}
