'use client';

import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Edges, Grid, Html, OrbitControls, useCursor} from '@react-three/drei';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import type {EngineeringArtifactType, EngineeringGeometry, EngineeringModel, EngineeringModule, Vector3Tuple} from '@/lib/engineering/build-engineering-model';

type EngineeringModelViewerProps = {
  model: EngineeringModel;
  selectedModuleId: string;
  exploded: boolean;
  resetSignal: number;
  onSelectModule: (moduleId: string) => void;
};

type PartSpec = {
  geometry: EngineeringGeometry | 'cone';
  position: Vector3Tuple;
  scale: Vector3Tuple;
  rotation?: Vector3Tuple;
  opacity?: number;
  wireframe?: boolean;
};

export function EngineeringModelViewer({model, selectedModuleId, exploded, resetSignal, onSelectModule}: EngineeringModelViewerProps) {
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
          {model.modules.map(module => (
            <ModuleMesh
              artifactType={model.artifactType}
              exploded={exploded}
              key={module.id}
              module={module}
              onSelect={onSelectModule}
              selected={selectedModuleId === module.id}
            />
          ))}
        </group>

        <Grid args={[24, 24]} cellColor="#154a4c" cellSize={.5} cellThickness={.45} fadeDistance={15} fadeStrength={1.7} position={[0, -2.65, 0]} sectionColor="#2a8d8d" sectionSize={2} sectionThickness={.8} />
        <axesHelper args={[2.4]} position={[-3.7, -2.55, -2.2]} />
        <CameraRig resetSignal={resetSignal} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-100/[0.08] shadow-[inset_0_0_70px_rgba(18,204,194,.035)]" />
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[8px] tracking-[.18em] text-cyan-100/35 uppercase">R3F / PROCEDURAL ASSEMBLY</div>
      <div className="pointer-events-none absolute bottom-4 right-4 text-right font-mono text-[8px] leading-4 tracking-[.12em] text-cyan-100/30 uppercase">X/Y/Z engineering coordinates<br />drag rotate / wheel zoom / shift pan</div>
    </div>
  );
}

function ModuleMesh({artifactType, module, selected, exploded, onSelect}: {artifactType: EngineeringArtifactType; module: EngineeringModule; selected: boolean; exploded: boolean; onSelect: (id: string) => void}) {
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

  const stop = (event: {stopPropagation: () => void}) => event.stopPropagation();
  const labelY = Math.max(.75, module.scale[1] + .42);

  return (
    <group
      onClick={event => { stop(event); onSelect(module.id); }}
      onPointerOut={event => { stop(event); setHovered(false); }}
      onPointerOver={event => { stop(event); setHovered(true); }}
      position={module.position}
      ref={groupRef}
    >
      <ArtifactModuleGeometry artifactType={artifactType} highlighted={selected || hovered} module={module} />
      <StatusBeacon module={module} y={labelY - .18} />
      {(selected || hovered) && (
        <Html center position={[0, labelY, 0]} style={{pointerEvents: 'none'}} transform={false}>
          <div className="whitespace-nowrap rounded border border-cyan-100/20 bg-[#02090b]/90 px-2 py-1 font-mono text-[8px] tracking-[.08em] text-cyan-50/80 uppercase shadow-[0_0_18px_rgba(34,211,201,.14)] backdrop-blur-md">
            {module.label} / {module.progress}%
          </div>
        </Html>
      )}
    </group>
  );
}

function ArtifactModuleGeometry({artifactType, module, highlighted}: {artifactType: EngineeringArtifactType; module: EngineeringModule; highlighted: boolean}) {
  const parts = moduleParts(artifactType, module);
  return <>{parts.map((part, index) => <ModulePart highlighted={highlighted} key={`${module.key}:${index}`} module={module} part={part} />)}</>;
}

function ModulePart({module, part, highlighted}: {module: EngineeringModule; part: PartSpec; highlighted: boolean}) {
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

function moduleParts(type: EngineeringArtifactType, module: EngineeringModule): PartSpec[] {
  const key = module.key;
  if (type === 'flying_vehicle') {
    if (key === 'body') return [box([0, 0, 0], [3.25, .68, 1.45]), box([0, -.12, 1.02], [2.1, .38, .65]), box([0, -.1, -1.02], [2.35, .42, .65])];
    if (key === 'cabin') return [sphere([0, 0, 0], [.9, .48, .82]), box([0, -.22, .12], [1.72, .35, 1.3])];
    if (key === 'lift') return [box([-1.95, 0, 0], [1.35, .13, .76]), box([1.95, 0, 0], [1.35, .13, .76]), ...[-2.45, 2.45].flatMap(x => [-.48, .48].map(z => torus([x, .08, z], [.38, .045, .38], [Math.PI / 2, 0, 0])))];
    if (key === 'propulsion') return [cylinder([-.88, 0, .88], [.3, .82, .3], [Math.PI / 2, 0, 0]), cylinder([.88, 0, .88], [.3, .82, .3], [Math.PI / 2, 0, 0]), cone([-.88, 0, 1.35], [.34, .52, .34], [Math.PI / 2, 0, 0]), cone([.88, 0, 1.35], [.34, .52, .34], [Math.PI / 2, 0, 0])];
    if (key === 'power') return [box([0, 0, 0], [2.05, .4, .92]), ...[-.72, -.24, .24, .72].map(x => cylinder([x, 0, 0], [.13, .68, .13], [0, 0, Math.PI / 2]))];
    if (key === 'control') return [box([0, 0, 0], [1.05, .34, .58]), sphere([-.38, .12, -.24], [.11, .11, .11]), sphere([.38, .12, -.24], [.11, .11, .11])];
  }

  if (type === 'wearable_suit') {
    if (key === 'torso') return [box([0, .08, 0], [1.32, 1.5, .64]), box([0, -.7, 0], [.88, .35, .52])];
    if (key === 'helmet') return [sphere([0, 0, 0], [.5, .58, .47]), box([0, -.03, -.4], [.72, .23, .08])];
    if (key === 'arms') return [...[-1, 1].flatMap(side => [cylinder([side * .94, .2, 0], [.2, .92, .2], [0, 0, side * -.16]), cylinder([side * 1.08, -.65, 0], [.18, .76, .18], [0, 0, side * .08]), sphere([side * .86, .72, 0], [.28, .28, .28])])];
    if (key === 'legs') return [...[-1, 1].flatMap(side => [cylinder([side * .38, .12, 0], [.25, 1.05, .25], [0, 0, side * -.04]), cylinder([side * .42, -.9, 0], [.22, .92, .22]), box([side * .42, -1.42, -.12], [.48, .22, .75])])];
    if (key === 'power_core') return [torus([0, 0, 0], [.34, .09, .34]), sphere([0, 0, 0], [.19, .19, .19])];
    if (key === 'thrusters') return [-1, 1].flatMap(side => [cylinder([side * .42, 0, 0], [.2, .58, .2]), cone([side * .42, -.48, 0], [.24, .42, .24])]);
  }

  if (type === 'battery') {
    if (key === 'casing') return [box([0, 1.22, 0], [3, .14, 1.55]), box([0, -1.22, 0], [3, .14, 1.55]), box([-1.43, 0, 0], [.14, 2.35, 1.55]), box([1.43, 0, 0], [.14, 2.35, 1.55]), box([0, 0, .72], [2.75, 2.2, .1], .28)];
    if (key === 'cells') return [-.9, -.3, .3, .9].flatMap(x => [-.38, .38].map(z => cylinder([x, 0, z], [.24, 2.05, .24])));
    if (key === 'separator') return [box([-.6, 0, 0], [.08, 2.05, 1.08], .42), box([0, 0, 0], [.08, 2.05, 1.08], .42), box([.6, 0, 0], [.08, 2.05, 1.08], .42)];
    if (key === 'terminals') return [cylinder([-.72, 0, 0], [.18, .42, .18]), cylinder([.72, 0, 0], [.18, .42, .18]), box([0, -.12, 0], [1.55, .12, .22])];
    if (key === 'air_filter') return [box([0, 0, 0], [1.5, .38, .42]), ...[-.54, -.27, 0, .27, .54].map(x => box([x, 0, -.24], [.08, .28, .18]))];
    if (key === 'control') return [box([0, 0, 0], [.7, .65, .92]), ...[-.2, 0, .2].map(y => box([0, y, -.5], [.48, .06, .08]))];
  }

  if (type === 'propulsion_system') {
    if (key === 'frame') return [cylinder([0, 0, 0], [.82, 2.5, .82]), torus([0, .85, 0], [.9, .08, .9], [Math.PI / 2, 0, 0]), torus([0, -.85, 0], [.9, .08, .9], [Math.PI / 2, 0, 0])];
    if (key === 'power') return [sphere([0, 0, 0], [.62, .62, .62]), torus([0, 0, 0], [.74, .06, .74], [Math.PI / 2, 0, 0])];
    if (key === 'chamber') return [cylinder([0, 0, 0], [.72, 1.75, .72]), sphere([0, .45, 0], [.5, .5, .5])];
    if (key === 'field') return [-.45, 0, .45].map(y => torus([0, y, 0], [.95, .08, .95], [Math.PI / 2, 0, 0]));
    if (key === 'nozzle') return [cone([0, 0, 0], [.82, 1.65, .82], [0, 0, Math.PI])];
    if (key === 'control') return [box([0, 0, 0], [.72, .88, .62]), sphere([0, .5, 0], [.12, .12, .12])];
  }

  return [{geometry: module.geometry, position: [0, 0, 0], scale: module.geometry === 'box' ? [module.scale[0] * 2, module.scale[1] * 2, module.scale[2] * 2] : module.scale}];
}

function box(position: Vector3Tuple, scale: Vector3Tuple, opacity?: number): PartSpec { return {geometry: 'box', position, scale, opacity}; }
function cylinder(position: Vector3Tuple, scale: Vector3Tuple, rotation?: Vector3Tuple): PartSpec { return {geometry: 'cylinder', position, scale, rotation}; }
function sphere(position: Vector3Tuple, scale: Vector3Tuple): PartSpec { return {geometry: 'sphere', position, scale}; }
function torus(position: Vector3Tuple, scale: Vector3Tuple, rotation?: Vector3Tuple): PartSpec { return {geometry: 'torus', position, scale, rotation}; }
function cone(position: Vector3Tuple, scale: Vector3Tuple, rotation?: Vector3Tuple): PartSpec { return {geometry: 'cone', position, scale, rotation}; }

function StatusBeacon({module, y}: {module: EngineeringModule; y: number}) {
  const color = {info: '#5eead4', success: '#4ade80', warning: '#fbbf24', critical: '#fb7185'}[module.severity];
  return <mesh position={[0, y, 0]}><sphereGeometry args={[.07, 12, 8]} /><meshBasicMaterial color={color} /><pointLight color={color} distance={1.8} intensity={3} /></mesh>;
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
