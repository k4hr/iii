'use client';

import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Edges, Grid, Html, Line, OrbitControls, useCursor} from '@react-three/drei';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import type {CanonicalEngineeringGeometryPrimitive, CanonicalEngineeringModel, EngineeringSeverity, Vector3Tuple} from '@/lib/engineering/engineering-model-schema';
import {buildEngineeringRenderModules, buildEngineeringRenderPrimitives, type EngineeringRenderModule, type EngineeringRenderPrimitive} from '@/lib/engineering/build-engineering-model';

type EngineeringModelViewerProps = {
  model: CanonicalEngineeringModel;
  selectedModuleId: string;
  exploded: boolean;
  resetSignal: number;
  onSelectModule: (moduleId: string) => void;
};

export function EngineeringModelViewer({model, selectedModuleId, exploded, resetSignal, onSelectModule}: EngineeringModelViewerProps) {
  const modules = useMemo(() => buildEngineeringRenderModules(model), [model]);
  const primitives = useMemo(() => buildEngineeringRenderPrimitives(model), [model]);
  const primitiveMap = useMemo(() => new Map(primitives.map(primitive => [primitive.id, primitive])), [primitives]);

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
          {model.geometryPlan.connectors.map((connector, index) => {
            const from = primitiveMap.get(connector.fromPrimitiveId);
            const to = primitiveMap.get(connector.toPrimitiveId);
            if (!from || !to) return null;
            return <PrimitiveConnector exploded={exploded} from={from} key={`${connector.fromPrimitiveId}:${connector.toPrimitiveId}:${index}`} to={to} type={connector.type} />;
          })}
          {primitives.map(primitive => (
            <PrimitiveMesh exploded={exploded} key={primitive.id} onSelect={onSelectModule} primitive={primitive} selected={selectedModuleId === primitive.moduleId} />
          ))}
          {modules.map(module => <ModuleOverlayAnchor key={module.id} module={module} selected={selectedModuleId === module.id} />)}
        </group>

        <Grid args={[24, 24]} cellColor="#154a4c" cellSize={.5} cellThickness={.45} fadeDistance={15} fadeStrength={1.7} position={[0, -2.65, 0]} sectionColor="#2a8d8d" sectionSize={2} sectionThickness={.8} />
        <axesHelper args={[2.4]} position={[-3.7, -2.55, -2.2]} />
        <CameraRig resetSignal={resetSignal} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-100/[0.08] shadow-[inset_0_0_70px_rgba(18,204,194,.035)]" />
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[8px] tracking-[.18em] text-cyan-100/35 uppercase">GEOMETRY PLAN / UNIVERSAL PROCEDURAL ASSEMBLY</div>
      <div className="pointer-events-none absolute bottom-4 right-4 text-right font-mono text-[8px] leading-4 tracking-[.12em] text-cyan-100/30 uppercase">primitive graph: {model.geometryPlan.layout}<br />drag rotate / wheel zoom / shift pan</div>
    </div>
  );
}

function PrimitiveMesh({primitive, selected, exploded, onSelect}: {primitive: EngineeringRenderPrimitive; selected: boolean; exploded: boolean; onSelect: (id: string) => void}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const target = useMemo(() => new THREE.Vector3(...(exploded ? primitive.explodedPosition : primitive.position)), [exploded, primitive.explodedPosition, primitive.position]);
  const targetScale = selected ? 1.07 : hovered ? 1.035 : 1;
  useCursor(hovered);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(target, 1 - Math.exp(-delta * 6.5));
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-delta * 8));
  });

  return (
    <group
      onClick={event => { event.stopPropagation(); onSelect(primitive.moduleId); }}
      onPointerOut={event => { event.stopPropagation(); setHovered(false); }}
      onPointerOver={event => { event.stopPropagation(); setHovered(true); }}
      position={primitive.position}
      ref={groupRef}
      rotation={primitive.rotation}
    >
      <PrimitiveShape highlighted={selected || hovered} primitive={primitive} />
      {(selected || hovered) && (
        <Html center position={[0, primitive.scale[1] + .48, 0]} style={{pointerEvents: 'none'}} transform={false}>
          <div className="whitespace-nowrap rounded border border-cyan-100/20 bg-[#02090b]/90 px-2 py-1 font-mono text-[8px] tracking-[.08em] text-cyan-50/80 uppercase shadow-[0_0_18px_rgba(34,211,201,.14)] backdrop-blur-md">
            {primitive.module.name} / {primitive.shape} / {primitive.module.feasibilityScore}%
          </div>
        </Html>
      )}
    </group>
  );
}

function PrimitiveShape({primitive, highlighted}: {primitive: EngineeringRenderPrimitive; highlighted: boolean}) {
  if (primitive.shape === 'cell_stack') {
    return (
      <group>
        {[-.42, 0, .42].map((x, column) => [-.22, .22].map((z, row) => (
          <PrimitivePart color={primitive.color} highlighted={highlighted} key={`${column}:${row}`} opacity={primitive.opacity} position={[x * primitive.scale[0], 0, z * primitive.scale[2]]} scale={[primitive.scale[0] * .28, primitive.scale[1], primitive.scale[2] * .28]} shape="cylinder" />
        )))}
      </group>
    );
  }
  if (primitive.shape === 'lattice') {
    return (
      <group>
        {[-.5, 0, .5].map((x, index) => <PrimitivePart color={primitive.color} highlighted={highlighted} key={`fin-${index}`} opacity={primitive.opacity} position={[x * primitive.scale[0], 0, 0]} scale={[primitive.scale[0] * .08, primitive.scale[1], primitive.scale[2]]} shape="box" />)}
        <PrimitivePart color={primitive.color} highlighted={highlighted} opacity={primitive.opacity} position={[0, 0, 0]} scale={[primitive.scale[0], primitive.scale[1] * .16, primitive.scale[2]]} shape="box" />
      </group>
    );
  }
  if (primitive.shape === 'curved_blade') {
    return (
      <group>
        <PrimitivePart color={primitive.color} highlighted={highlighted} opacity={primitive.opacity} position={[0, 0, 0]} scale={primitive.scale} shape="box" />
        <PrimitivePart color={primitive.color} highlighted={highlighted} opacity={primitive.opacity} position={[primitive.scale[0] * .55, 0, primitive.scale[2] * .28]} scale={[primitive.scale[0] * .42, primitive.scale[1], primitive.scale[2] * .7]} shape="cone" />
      </group>
    );
  }
  return <PrimitivePart color={primitive.color} highlighted={highlighted} opacity={primitive.opacity} position={[0, 0, 0]} scale={primitive.scale} shape={primitive.shape} />;
}

function PrimitivePart({shape, position, scale, color, highlighted, opacity}: {shape: CanonicalEngineeringGeometryPrimitive['shape'] | 'box'; position: Vector3Tuple; scale: Vector3Tuple; color: string; highlighted: boolean; opacity?: number}) {
  return (
    <mesh castShadow position={position} scale={shape === 'sphere' || shape === 'capsule' ? scale : [1, 1, 1]}>
      <PrimitiveGeometry scale={scale} shape={shape} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={highlighted ? .34 : .1} metalness={.7} opacity={opacity ?? (highlighted ? .92 : .72)} roughness={.24} transparent />
      <Edges color={highlighted ? '#e5fffc' : color} lineWidth={highlighted ? 1.5 : .65} threshold={12} />
    </mesh>
  );
}

function PrimitiveGeometry({shape, scale}: {shape: CanonicalEngineeringGeometryPrimitive['shape'] | 'box'; scale: Vector3Tuple}) {
  if (shape === 'sphere') return <sphereGeometry args={[1, 22, 14]} />;
  if (shape === 'capsule') return <capsuleGeometry args={[1, 1.3, 10, 18]} />;
  if (shape === 'cylinder' || shape === 'tube') return <cylinderGeometry args={[scale[0], scale[0] * .82, scale[1], 20, 2]} />;
  if (shape === 'cone') return <coneGeometry args={[scale[0], scale[1], 20]} />;
  if (shape === 'torus' || shape === 'ring') return <torusGeometry args={[scale[0], Math.max(.025, scale[1]), 10, 34]} />;
  if (shape === 'disc') return <cylinderGeometry args={[scale[0], scale[0], Math.max(.025, scale[1]), 42, 1]} />;
  if (shape === 'wing') return <boxGeometry args={[scale[0] * 2.2, scale[1], scale[2]]} />;
  if (shape === 'panel') return <boxGeometry args={[scale[0], Math.max(.025, scale[1]), scale[2]]} />;
  return <boxGeometry args={scale} />;
}

function PrimitiveConnector({from, to, type, exploded}: {from: EngineeringRenderPrimitive; to: EngineeringRenderPrimitive; type: CanonicalEngineeringModel['geometryPlan']['connectors'][number]['type']; exploded: boolean}) {
  const colors = {energy: '#f4bf4f', signal: '#55b9ff', heat: '#ff765f', material_flow: '#9dd66f', force: '#fb7185', structural: '#35d5d0'};
  return <Line color={colors[type]} dashed lineWidth={.7} opacity={.42} points={[exploded ? from.explodedPosition : from.position, exploded ? to.explodedPosition : to.position]} transparent />;
}

function ModuleOverlayAnchor({module, selected}: {module: EngineeringRenderModule; selected: boolean}) {
  return (
    <group position={module.position}>
      <StatusBeacon module={module} />
      <OverlayBeacons module={module} />
      {selected && <pointLight color={module.color} distance={2.8} intensity={4} />}
    </group>
  );
}

function StatusBeacon({module}: {module: EngineeringRenderModule}) {
  const color = {info: '#5eead4', success: '#4ade80', warning: '#fbbf24', critical: '#fb7185'}[module.severity];
  return <mesh position={[0, module.scale[1] + .28, 0]}><sphereGeometry args={[.07, 12, 8]} /><meshBasicMaterial color={color} /><pointLight color={color} distance={1.8} intensity={3} /></mesh>;
}

function OverlayBeacons({module}: {module: EngineeringRenderModule}) {
  return (
    <group>
      {module.overlays.slice(0, 5).map((overlay, index) => {
        const angle = index * 1.256;
        const color = overlayColor(overlay.severity);
        return (
          <mesh key={overlay.id} position={[Math.cos(angle) * (module.scale[0] + .22), module.scale[1] + .1 + index * .045, Math.sin(angle) * (module.scale[2] + .22)]}>
            <sphereGeometry args={[.045, 10, 8]} />
            <meshBasicMaterial color={color} />
            <pointLight color={color} distance={1.2} intensity={1.4} />
          </mesh>
        );
      })}
    </group>
  );
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
