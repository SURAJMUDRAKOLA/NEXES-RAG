'use client';
// Three.js particle field — fast-moving violet/blue constellation
// Uses @react-three/fiber + @react-three/drei, ssr:false via next/dynamic

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Individual particle system ───────────────────────────────────────────────
function Particles({ count = 2200 }: { count?: number }) {
  const mesh = useRef<THREE.Points>(null!);
  const linesMesh = useRef<THREE.LineSegments>(null!);

  // Build geometry
  const { positions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3]     = (Math.random() - 0.5) * 28;
      positions[i3 + 1] = (Math.random() - 0.5) * 16;
      positions[i3 + 2] = (Math.random() - 0.5) * 10;

      // Different speed tiers for depth
      const speed = 0.006 + Math.random() * 0.022;
      const angle = Math.random() * Math.PI * 2;
      velocities[i3]     = Math.cos(angle) * speed;
      velocities[i3 + 1] = Math.sin(angle) * speed * 0.4;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.005;

      // Violet → blue colour mix
      const t = Math.random();
      if (t < 0.55) {
        // violet
        colors[i3]     = 0.48 + Math.random() * 0.20; // r
        colors[i3 + 1] = 0.22 + Math.random() * 0.15; // g
        colors[i3 + 2] = 0.90 + Math.random() * 0.10; // b
      } else if (t < 0.80) {
        // blue
        colors[i3]     = 0.20 + Math.random() * 0.15;
        colors[i3 + 1] = 0.45 + Math.random() * 0.25;
        colors[i3 + 2] = 0.95 + Math.random() * 0.05;
      } else {
        // white/near-white
        colors[i3]     = 0.85 + Math.random() * 0.15;
        colors[i3 + 1] = 0.80 + Math.random() * 0.20;
        colors[i3 + 2] = 1.0;
      }
    }
    return { positions, velocities, colors };
  }, [count]);

  // Animate
  useFrame(() => {
    if (!mesh.current) return;
    const pos = mesh.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3]     += velocities[i3];
      pos[i3 + 1] += velocities[i3 + 1];
      pos[i3 + 2] += velocities[i3 + 2];

      // Wrap around edges
      if (pos[i3]     >  14) pos[i3]     = -14;
      if (pos[i3]     < -14) pos[i3]     =  14;
      if (pos[i3 + 1] >   8) pos[i3 + 1] =  -8;
      if (pos[i3 + 1] <  -8) pos[i3 + 1] =   8;
    }

    mesh.current.geometry.attributes.position.needsUpdate = true;
    mesh.current.rotation.z += 0.00015;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
    return geo;
  }, [positions, colors]);

  return (
    <points ref={mesh} geometry={geometry}>
      <pointsMaterial
        size={0.055}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ── Connection lines between nearby particles ────────────────────────────────
function ConnectionLines({ count = 180 }: { count?: number }) {
  const ref = useRef<THREE.LineSegments>(null!);

  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < count; i++) {
      const x1 = (Math.random() - 0.5) * 20;
      const y1 = (Math.random() - 0.5) * 12;
      const x2 = x1 + (Math.random() - 0.5) * 4;
      const y2 = y1 + (Math.random() - 0.5) * 3;
      pts.push(x1, y1, 0, x2, y2, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [count]);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = clock.getElapsedTime() * 0.008;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.05) * 0.08;
    }
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#7c3aed" transparent opacity={0.12} />
    </lineSegments>
  );
}

// ── Slow rotating ring ───────────────────────────────────────────────────────
function CosmicRing() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = clock.getElapsedTime() * 0.025;
      ref.current.rotation.x = 0.42;
    }
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[4.8, 0.012, 6, 160]} />
      <meshBasicMaterial color="#a78bfa" transparent opacity={0.35} />
    </mesh>
  );
}

// ── Exported component — wrapped in Canvas ───────────────────────────────────
export default function ParticleField() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 60 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      dpr={[1, 1.5]}
    >
      <Particles count={2200} />
      <ConnectionLines count={220} />
      <CosmicRing />
    </Canvas>
  );
}
