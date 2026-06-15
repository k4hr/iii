'use client';

import {Canvas, type ThreeEvent, useFrame, useThree} from '@react-three/fiber';
import {Edges, Grid, OrbitControls} from '@react-three/drei';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import type {EngineeringGeometry, EngineeringModel, EngineeringModule} from '@/lib/engineering/build-engineering-model';

type EngineeringModelViewerProps = {
  model: EngineeringModel;
  selectedModuleId: string;
  exploded: boolean;
  resetSignal: number;
  onSelectModule: (moduleId: string) => void;
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
              exploded={exploded}
              key={module.id}
              module={module}
              onSelect={onSelectModule}
              selected={selectedModuleId === module.id}
            />
          ))}
        </group>

        <Grid
          args={[24, 24]}
          cellColor="#154a4c"
          cellSize={.5}
          cellThickness={.45}
          fadeDistance={15}
          fadeStrength={1.7}
          position={[0, -2.65, 0]}
          sectionColor="#2a8d8d"
          sectionSize={2}
          sectionThickness={.8}
        />
        <axesHelper args={[2.4]} position={[-3.7, -2.55, -2.2]} />
        <CameraRig resetSignal={resetSignal} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-100/[0.08] shadow-[inset_0_0_70px_rgba(18,204,194,.035)]" />
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[8px] tracking-[.18em] text-cyan-100/35 uppercase">R3F / PROCEDURAL ASSEMBLY</div>
      <div className="pointer-events-none absolute bottom-4 right-4 text-right font-mono text-[8px] leading-4 tracking-[.12em] text-cyan-100/30 uppercase">
        X/Y/Z engineering coordinates<br />drag rotate / wheel zoom / shift pan
      </div>
    </div>
  );
}

function ModuleMesh({module, selected, exploded, onSelect}: {module: EngineeringModule; selected: boolean; exploded: boolean; onSelect: (id: string) => void}) {
  const groupRef = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(...(exploded ? module.explodedPosition : module.position)), [exploded, module.explodedPosition, module.position]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(target, 1 - Math.exp(-delta * 6.5));
    const targetScale = selected ? 1.08 : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-delta * 8));
  });

  const handlePointer = (event: ThreeEvent<PointerEvent>, active: boolean) => {
    event.stopPropagation();
    event.nativeEvent.target instanceof HTMLElement && (event.nativeEvent.target.style.cursor = active ? 'pointer' : 'auto');
  };

  return (
    <group ref={groupRef} position={module.position}>
      <mesh
        castShadow
        onClick={event => { event.stopPropagation(); onSelect(module.id); }}
        onPointerOut={event => handlePointer(event, false)}
        onPointerOver={event => handlePointer(event, true)}
      >
        <ModuleGeometry geometry={module.geometry} scale={module.scale} />
        <meshStandardMaterial
          color={module.color}
          emissive={module.color}
          emissiveIntensity={selected ? .38 : .12}
          metalness={.72}
          opacity={selected ? .94 : .72}
          roughness={.25}
          transparent
          wireframe={!selected}
        />
        <Edges color={selected ? '#e5fffc' : module.color} lineWidth={selected ? 1.8 : .8} threshold={12} />
      </mesh>
      <StatusBeacon module={module} />
    </group>
  );
}

function ModuleGeometry({geometry, scale}: {geometry: EngineeringGeometry; scale: [number, number, number]}) {
  if (geometry === 'cylinder') return <cylinderGeometry args={[scale[0], scale[0] * .8, scale[1] * 2, 20, 2]} />;
  if (geometry === 'sphere') return <sphereGeometry args={[scale[0], 22, 14]} />;
  if (geometry === 'torus') return <torusGeometry args={[scale[0], Math.max(.08, scale[2]), 10, 28]} />;
  return <boxGeometry args={[scale[0] * 2, scale[1] * 2, scale[2] * 2]} />;
}

function StatusBeacon({module}: {module: EngineeringModule}) {
  const color = {info: '#5eead4', success: '#4ade80', warning: '#fbbf24', critical: '#fb7185'}[module.severity];
  return (
    <mesh position={[0, module.scale[1] + .25, 0]}>
      <sphereGeometry args={[.07, 12, 8]} />
      <meshBasicMaterial color={color} />
      <pointLight color={color} distance={1.8} intensity={3} />
    </mesh>
  );
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
