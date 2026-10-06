'use client';
// components/three/ParticleField.tsx
// Section 3.2 — exact implementation from blueprint
// Lazy loaded via next/dynamic — NEVER SSR (Rule 7 Section 15.3)
// 3000 particles with per-point phase offset + mouse parallax

import { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // 3000 particles with per-point phase offset
    const COUNT = 3000;
    const positions = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);

    // Secondary smaller particle layer for depth
    const COUNT2 = 800;
    const pos2 = new Float32Array(COUNT2 * 3);
    const phases2 = new Float32Array(COUNT2);
    for (let i = 0; i < COUNT2; i++) {
      pos2[i * 3]     = (Math.random() - 0.5) * 16;
      pos2[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos2[i * 3 + 2] = (Math.random() - 0.5) * 8;
      phases2[i] = Math.random() * Math.PI * 2;
    }
    const geo2 = new THREE.BufferGeometry();
    const posAttr2 = new THREE.BufferAttribute(pos2, 3);
    posAttr2.setUsage(THREE.DynamicDrawUsage);
    geo2.setAttribute('position', posAttr2);

    const mat = new THREE.PointsMaterial({
      color: 0x7C3AED,  // accent violet
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
    });

    const mat2 = new THREE.PointsMaterial({
      color: 0xA78BFA,  // accent-light
      size: 0.015,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.3,
    });

    const points = new THREE.Points(geo, mat);
    const points2 = new THREE.Points(geo2, mat2);
    scene.add(points);
    scene.add(points2);

    let mouse = { x: 0, y: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Resize handler
    const handleResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    let time = 0;
    let raf: number;

    function animate() {
      raf = requestAnimationFrame(animate);
      time += 0.005;

      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        (pos.array as Float32Array)[i * 3 + 1] =
          positions[i * 3 + 1] + Math.sin(time + phases[i]) * 0.08;
      }
      pos.needsUpdate = true;

      const pos2arr = geo2.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < COUNT2; i++) {
        (pos2arr.array as Float32Array)[i * 3 + 1] =
          pos2[i * 3 + 1] + Math.sin(time * 0.7 + phases2[i]) * 0.05;
      }
      pos2arr.needsUpdate = true;

      // Smooth mouse parallax
      points.rotation.y  += (mouse.x * 0.2  - points.rotation.y)  * 0.05;
      points.rotation.x  += (mouse.y * 0.1  - points.rotation.x)  * 0.05;
      points2.rotation.y += (mouse.x * 0.12 - points2.rotation.y) * 0.03;
      points2.rotation.x += (mouse.y * 0.06 - points2.rotation.x) * 0.03;

      renderer.render(scene, camera);
    }
    animate();

    // Cleanup — Rule 3 Section 15.3: MUST dispose all Three.js resources
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      geo.dispose();
      geo2.dispose();
      mat.dispose();
      mat2.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
