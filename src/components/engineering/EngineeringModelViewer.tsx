'use client';

import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Edges, Grid, Html, Line, OrbitControls, useCursor} from '@react-three/drei';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import type {CanonicalEngineeringModel, CanonicalEngineeringModule} from '@/lib/engineering/engineering-model-schema';
import {buildEngineeringRenderModules, type EngineeringRenderModule, type Vector3Tuple} from '@/lib/engineering/build-engineering-model';

type EngineeringModelViewerProps = {
  model: CanonicalEngineeringModel;
  selectedModuleId: string;
  exploded: boolean;
  resetSignal: number;
  onSelectModule: (moduleId: string) => void;
};

type PartSpec = {
  geometry: 'box' | 'cylinder' | 'sphere' | 'torus' | 'cone';
  position: Vector3Tuple;
  scale: Vector3Tuple;
  rotation?: Vector3Tuple;
  opacity?: number;
  wireframe?: boolean;
};

export function EngineeringModelViewer({model, selectedModuleId, exploded, resetSignal, onSelectModule}: EngineeringModelViewerProps) {
  const modules = useMemo(() => buildEngineeringRenderModules(model), [model]);
  const moduleMap = useMemo(() => new Map(modules.map(module => [module.id, module])), [modules]);

  return (
    <div className="relative h-[430px] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_42%,rgba(27,209,201,.09),transparent_42%),linear-gradient(180deg,#030a0c,#010405)] sm:h-[560px]">
      <Canvas camera={{position: [6, 4, 7], fov: 42, near: .1, far: 100}} dpr={[1, 1.5]} gl={{antialias: true, alpha: true}}>
        <color attach="background" args={['#020708']} />
        <fog attach="fog" args={['#020708', 10, 24]} />
        <ambientLight intensity={.7} />
        <directionalLight color="#8ffcf0" intensity={2.4} position={[5, 7, 5]} />
        <pointLight color="#38bdf8" intensity={24} position={[-4, 1, 3]} distance={10} />
        <pointLight color="#34d399" intensity={16} position={[4, -2, -2]} distance={9} />

        <group rotation={[0, -.35, 0]}>
          {model.interfaces.map((link, index) => {
            const from = moduleMap.get(link.fromModuleId);
            const to = moduleMap.get(link.toModuleId);
            if (!from || !to) return null;
            return <InterfaceLine exploded={exploded} from={from} key={`${link.fromModuleId}:${link.toModuleId}:${index}`} to={to} type={link.type} />;
          })}
          {modules.map(module => (
            <ModuleMesh exploded={exploded} key={module.id} module={module} onSelect={onSelectModule} selected={selectedModuleId === module.id} />
          ))}
        </group>

        <Grid args={[24, 24]} cellColor="#154a4c" cellSize={.5} cellThickness={.45} fadeDistance={15} fadeStrength={1.7} position={[0, -2.65, 0]} sectionColor="#2a8d8d" sectionSize={2} sectionThickness={.8} />
        <axesHelper args={[2.4]} position={[-3.7, -2.55, -2.2]} />
        <CameraRig resetSignal={resetSignal} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-100/[0.08] shadow-[inset_0_0_70px_rgba(18,204,194,.035)]" />
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[8px] tracking-[.18em] text-cyan-100/35 uppercase">CANONICAL MODEL / PROCEDURAL ASSEMBLY</div>
      <div className="pointer-events-none absolute bottom-4 right-4 text-right font-mono text-[8px] leading-4 tracking-[.12em] text-cyan-100/30 uppercase">X/Y/Z engineering coordinates<br />drag rotate / wheel zoom / shift pan</div>
    </div>
  );
}

function ModuleMesh({module, selected, exploded, onSelect}: {module: EngineeringRenderModule; selected: boolean; exploded: boolean; onSelect: (id: string) => void}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const target = useMemo(() => new THREE.Vector3(...(exploded ? module.explodedPosition : module.position)), [exploded, module.explodedPosition, module.position]);
  const targetScale = selected ? 1.06 : hovered ? 1.025 : 1;
  useCursor(hovered);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(target, 1 - Math.exp(-delta * 6.5));
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-delta * 8));
  });

  return (
    <group
      onClick={event => { event.stopPropagation(); onSelect(module.id); }}
      onPointerOut={event => { event.stopPropagation(); setHovered(false); }}
      onPointerOver={event => { event.stopPropagation(); setHovered(true); }}
      position={module.position}
      ref={groupRef}
    >
      <HintGeometry highlighted={selected || hovered} module={module} />
      <StatusBeacon module={module} />
      {(selected || hovered) && (
        <Html center position={[0, module.scale[1] + .52, 0]} style={{pointerEvents: 'none'}} transform={false}>
          <div className="whitespace-nowrap rounded border border-cyan-100/20 bg-[#02090b]/90 px-2 py-1 font-mono text-[8px] tracking-[.08em] text-cyan-50/80 uppercase shadow-[0_0_18px_rgba(34,211,201,.14)] backdrop-blur-md">
            {module.name} / {module.feasibilityScore}%
          </div>
        </Html>
      )}
    </group>
  );
}

function HintGeometry({module, highlighted}: {module: EngineeringRenderModule; highlighted: boolean}) {
  return <>{partsForHint(module).map((part, index) => <ModulePart highlighted={highlighted} key={`${module.id}:${index}`} module={module} part={part} />)}</>;
}

function partsForHint(module: EngineeringRenderModule): PartSpec[] {
  const [x, y, z] = module.scale;
  switch (module.geometryHint) {
    case 'core': return [sphere([0, 0, 0], [x, y, z]), torus([0, 0, 0], [x * 1.15, Math.max(.05, x * .08), z], [Math.PI / 2, 0, 0])];
    case 'shell': return [box([0, 0, 0], [x * 2, y * 2, z * 2], .24, true), box([0, 0, 0], [x * 1.55, y * 1.55, z * 1.55], .5)];
    case 'ring': return [torus([0, 0, 0], [x, Math.max(.08, y), z]), torus([0, 0, 0], [x * .72, Math.max(.05, y * .55), z * .72])];
    case 'panel': return [box([0, 0, 0], [x * 2, y * 2, z * 2]), ...[-.45, 0, .45].map(offset => box([offset * x, 0, -z * 1.12], [x * .18, y * 1.35, z * .18]))];
    case 'arm': return [cylinder([0, .35, 0], [x, y * .95, z], [0, 0, -.16]), cylinder([.16, -.55, 0], [x * .82, y * .75, z * .82], [0, 0, .12]), sphere([-.12, y * .62, 0], [x * 1.3, x * 1.3, z * 1.3])];
    case 'leg': return [cylinder([0, .42, 0], [x, y, z]), cylinder([.08, -.72, 0], [x * .86, y * .78, z * .86]), box([.08, -y * .92, -.12], [x * 1.7, y * .18, z * 2.2])];
    case 'rotor': return [torus([0, 0, 0], [x, Math.max(.05, y), z], [Math.PI / 2, 0, 0]), box([0, 0, 0], [x * 1.9, y * .35, z * .12]), box([0, 0, 0], [x * .12, y * .35, z * 1.9])];
    case 'tank': return [cylinder([0, 0, 0], [x, y * 1.7, z]), sphere([0, y * .85, 0], [x, x, z]), sphere([0, -y * .85, 0], [x, x, z])];
    case 'cell': return [-.45, 0, .45].flatMap(column => [-.32, .32].map(depth => cylinder([column * x * 2, 0, depth * z * 2], [x * .72, y * 1.7, z * .72])));
    case 'probe': return [cylinder([0, 0, 0], [x, y * 1.5, z]), sphere([0, y * .82, 0], [x * 1.35, x * 1.35, z * 1.35]), cone([0, -y * .92, 0], [x * 1.1, y * .55, z * 1.1], [0, 0, Math.PI])];
    case 'tube': return [cylinder([0, 0, 0], [x, y * 1.45, z]), torus([0, y * .55, 0], [x * 1.08, x * .11, z], [Math.PI / 2, 0, 0]), cone([0, -y * .9, 0], [x * 1.15, y * .62, z * 1.15], [0, 0, Math.PI])];
    case 'block': return [box([0, 0, 0], [x * 2, y * 2, z * 2]), box([0, y * .72, 0], [x * 1.35, y * .16, z * 1.35])];
    default: return [box([0, 0, 0], [x * 1.8, y * 1.8, z * 1.8]), sphere([0, y * .65, 0], [x * .38, x * .38, z * .38])];
  }
}

function ModulePart({module, part, highlighted}: {module: EngineeringRenderModule; part: PartSpec; highlighted: boolean}) {
  return (
    <mesh castShadow position={part.position} rotation={part.rotation ?? [0, 0, 0]} scale={part.geometry === 'sphere' ? part.scale : [1, 1, 1]}>
      <PartGeometry part={part} />
      <meshStandardMaterial color={module.color} emissive={module.color} emissiveIntensity={highlighted ? .34 : .1} metalness={.7} opacity={part.opacity ?? (highlighted ? .92 : .72)} roughness={.24} transparent wireframe={part.wireframe ?? false} />
      <Edges color={highlighted ? '#e5fffc' : module.color} lineWidth={highlighted ? 1.5 : .65} threshold={12} />
    </mesh>
  );
}

function PartGeometry({part}: {part: PartSpec}) {
  if (part.geometry === 'cylinder') return <cylinderGeometry args={[part.scale[0], part.scale[0] * .82, part.scale[1], 20, 2]} />;
  if (part.geometry === 'sphere') return <sphereGeometry args={[1, 22, 14]} />;
  if (part.geometry === 'torus') return <torusGeometry args={[part.scale[0], part.scale[1], 10, 30]} />;
  if (part.geometry === 'cone') return <coneGeometry args={[part.scale[0], part.scale[1], 20]} />;
  return <boxGeometry args={part.scale} />;
}

function InterfaceLine({from, to, type, exploded}: {from: EngineeringRenderModule; to: EngineeringRenderModule; type: CanonicalEngineeringModel['interfaces'][number]['type']; exploded: boolean}) {
  const colors = {energy: '#f4bf4f', control: '#55b9ff', heat: '#ff765f', material_flow: '#9dd66f', signal: '#a58cff', structural: '#35d5d0'};
  return <Line color={colors[type]} dashed lineWidth={.7} opacity={.42} points={[exploded ? from.explodedPosition : from.position, exploded ? to.explodedPosition : to.position]} transparent />;
}

function StatusBeacon({module}: {module: EngineeringRenderModule}) {
  const color = {info: '#5eead4', success: '#4ade80', warning: '#fbbf24', critical: '#fb7185'}[module.severity];
  return <mesh position={[0, module.scale[1] + .28, 0]}><sphereGeometry args={[.07, 12, 8]} /><meshBasicMaterial color={color} /><pointLight color={color} distance={1.8} intensity={3} /></mesh>;
}

function box(position: Vector3Tuple, scale: Vector3Tuple, opacity?: number, wireframe?: boolean): PartSpec { return {geometry: 'box', position, scale, opacity, wireframe}; }
function cylinder(position: Vector3Tuple, scale: Vector3Tuple, rotation?: Vector3Tuple): PartSpec { return {geometry: 'cylinder', position, scale, rotation}; }
function sphere(position: Vector3Tuple, scale: Vector3Tuple): PartSpec { return {geometry: 'sphere', position, scale}; }
function torus(position: Vector3Tuple, scale: Vector3Tuple, rotation?: Vector3Tuple): PartSpec { return {geometry: 'torus', position, scale, rotation}; }
function cone(position: Vector3Tuple, scale: Vector3Tuple, rotation?: Vector3Tuple): PartSpec { return {geometry: 'cone', position, scale, rotation}; }

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
