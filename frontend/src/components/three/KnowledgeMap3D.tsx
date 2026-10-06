'use client';
// components/three/KnowledgeMap3D.tsx
// Section 3.5 — 3D UMAP knowledge graph  (Part 2 upgrade)
// Lazy loaded via next/dynamic (ssr: false) — Rule 7 Section 15.3

import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { UMAPNode } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Doc-type colours (spec §3.5) ────────────────────────────────────────────
const DOC_TYPE_COLORS: Record<string, string> = {
  pdf:   '#EF4444',
  pptx:  '#F97316',
  docx:  '#3B82F6',
  image: '#14B8A6',
  audio: '#7C3AED',
};
const DEFAULT_COLOR = '#8B5CF6';

function docColor(type: string): number {
  return parseInt((DOC_TYPE_COLORS[type] ?? DEFAULT_COLOR).replace('#', ''), 16);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface KnowledgeMap3DProps {
  nodes: UMAPNode[];
  loading?: boolean;
  onNodeHover?: (node: UMAPNode | null) => void;
  onNodeClick?: (node: UMAPNode) => void;
}

interface HoverLabel {
  node: UMAPNode;
  screenX: number;
  screenY: number;
}

// ─── Edge data kept in sync with line segments ────────────────────────────────
interface EdgeRecord {
  line: THREE.Line;
  iA: number;
  iB: number;
  mat: THREE.LineBasicMaterial;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function KnowledgeMap3D({
  nodes,
  loading = false,
  onNodeHover,
  onNodeClick,
}: KnowledgeMap3DProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // React state for HTML overlay label
  const [hoverLabel, setHoverLabel] = useState<HoverLabel | null>(null);
  const hoverLabelRef = useRef<HoverLabel | null>(null); // mirrors for Three loop

  // ─── Empty state (< 2 nodes) ─────────────────────────────────────────────
  const isEmpty = !loading && nodes.length < 2;

  // ─── Main Three.js effect ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading || nodes.length < 2) return;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // ── Scene + Fog ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040404, 0.06);

    // ── Camera ────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 8);

    // ── Node meshes ───────────────────────────────────────────────────────
    const meshes: THREE.Mesh[] = [];
    const nodeGeo = new THREE.SphereGeometry(0.14, 12, 12);
    const originalColors: number[] = [];
    const targetScales: number[] = [];

    nodes.forEach((node) => {
      const color = docColor(node.type);
      originalColors.push(color);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.set(node.x * 2, node.y * 2, (node.z ?? 0) * 2);
      mesh.userData = { node, baseColor: color };
      targetScales.push(1.0);
      scene.add(mesh);
      meshes.push(mesh);
    });

    // ── Glow rings (one per mesh, hidden by default) ───────────────────────
    const ringGeos: THREE.RingGeometry[] = [];
    const rings: THREE.Mesh[] = [];
    meshes.forEach((mesh) => {
      const ringGeo = new THREE.RingGeometry(0.18, 0.26, 32);
      ringGeos.push(ringGeo);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(mesh.position);
      scene.add(ring);
      rings.push(ring);
    });

    // ── Edges (LineSegments per pair) ──────────────────────────────────────
    const edges: EdgeRecord[] = [];
    const DIST_THRESHOLD = 0.8 * 2; // proximity proxy for similarity > 0.75

    for (let i = 0; i < meshes.length; i++) {
      for (let j = i + 1; j < meshes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        // Use similarity field if available, else distance proxy
        const similarity: number | undefined =
          (nodeA as UMAPNode & { similarity?: number }).similarity;
        const useProximity = similarity === undefined;
        const dist = meshes[i].position.distanceTo(meshes[j].position);
        const connected = useProximity
          ? dist < DIST_THRESHOLD
          : similarity > 0.75;

        if (connected) {
          const geo = new THREE.BufferGeometry().setFromPoints([
            meshes[i].position.clone(),
            meshes[j].position.clone(),
          ]);
          const mat = new THREE.LineBasicMaterial({
            color: 0x7c3aed,
            transparent: true,
            opacity: 0.25,
          });
          const line = new THREE.Line(geo, mat);
          scene.add(line);
          edges.push({ line, iA: i, iB: j, mat });
        }
      }
    }

    // ── Manual OrbitControls ───────────────────────────────────────────────
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = { theta: 0, phi: Math.PI / 2, radius: 8 };

    // Auto-rotate: 0.003 rad/frame after 5s idle
    let lastInteraction = Date.now();
    const AUTO_ROTATE_DELAY = 5000;
    const AUTO_ROTATE_SPEED = 0.003;

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse2D = new THREE.Vector2();
    let hoveredIndex = -1;

    const resetInteraction = () => { lastInteraction = Date.now(); };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
      resetInteraction();
    };
    const onMouseUp = () => { isDragging = false; };

    const onMouseMove = (e: MouseEvent) => {
      resetInteraction();
      const rect = canvas.getBoundingClientRect();

      if (!isDragging) {
        // ── Raycasting ─────────────────────────────────────────────────
        mouse2D.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse2D.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse2D, camera);
        const hits = raycaster.intersectObjects(meshes);

        const newIndex = hits.length > 0 ? meshes.indexOf(hits[0].object as THREE.Mesh) : -1;

        if (newIndex !== hoveredIndex) {
          hoveredIndex = newIndex;
          const hNode = newIndex >= 0 ? nodes[newIndex] : null;

          // Update React state for hover overlay card
          onNodeHover?.(hNode);

          if (hNode && newIndex >= 0) {
            // Compute screen position for label
            const pos3 = meshes[newIndex].position.clone();
            pos3.project(camera);
            const sx = ((pos3.x + 1) / 2) * rect.width + rect.left;
            const sy = ((-pos3.y + 1) / 2) * rect.height + rect.top;
            const label: HoverLabel = { node: hNode, screenX: sx, screenY: sy };
            hoverLabelRef.current = label;
            setHoverLabel(label);
          } else {
            hoverLabelRef.current = null;
            setHoverLabel(null);
          }

          // ── Scale targets ────────────────────────────────────────────
          meshes.forEach((_, idx) => {
            targetScales[idx] = idx === newIndex ? 1.6 : 1.0;
          });

          // ── Edge highlight ───────────────────────────────────────────
          edges.forEach(({ iA, iB, mat }) => {
            if (newIndex === -1) {
              mat.opacity = 0.25;
            } else if (iA === newIndex || iB === newIndex) {
              mat.opacity = 0.80;
            } else {
              mat.opacity = 0.05;
            }
          });
        }
        return;
      }

      // ── Orbit drag ─────────────────────────────────────────────────
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - dy * 0.005));
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onWheel = (e: WheelEvent) => {
      resetInteraction();
      spherical.radius = Math.max(3, Math.min(20, spherical.radius + e.deltaY * 0.01));
    };

    const onClick = (e: MouseEvent) => {
      if (hoveredIndex >= 0) onNodeClick?.(nodes[hoveredIndex]);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    canvas.addEventListener('click', onClick);

    // ── Animation loop ─────────────────────────────────────────────────────
    let raf: number;
    const WHITE = new THREE.Color(0xffffff);

    function animate() {
      raf = requestAnimationFrame(animate);

      // Auto-rotate
      if (!isDragging && Date.now() - lastInteraction > AUTO_ROTATE_DELAY) {
        spherical.theta += AUTO_ROTATE_SPEED;
      }

      // Camera from spherical
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0, 0);

      // Lerp node scales + material
      meshes.forEach((mesh, idx) => {
        const target = targetScales[idx];
        const cur = mesh.scale.x;
        const next = cur + (target - cur) * 0.12;
        mesh.scale.setScalar(next);

        const mat = mesh.material as THREE.MeshBasicMaterial;
        const baseHex = originalColors[idx];
        if (idx === hoveredIndex) {
          mat.color.lerp(WHITE, 0.12);
        } else {
          mat.color.lerp(new THREE.Color(baseHex), 0.12);
        }

        // Glow ring faces camera + fades in/out
        const ring = rings[idx];
        const ringMat = ring.material as THREE.MeshBasicMaterial;
        ring.position.copy(mesh.position);
        ring.lookAt(camera.position);
        const targetOpacity = idx === hoveredIndex ? 0.55 : 0;
        ringMat.opacity += (targetOpacity - ringMat.opacity) * 0.12;
      });

      renderer.render(scene, camera);
    }
    animate();

    // ── Resize ─────────────────────────────────────────────────────────────
    const handleResize = () => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(canvas);

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('click', onClick);
      ro.disconnect();
      nodeGeo.dispose();
      ringGeos.forEach((g) => g.dispose());
      meshes.forEach((m) => (m.material as THREE.Material).dispose());
      rings.forEach((r) => (r.material as THREE.Material).dispose());
      edges.forEach(({ line, mat }) => { line.geometry.dispose(); mat.dispose(); });
      renderer.dispose();
    };
  }, [nodes, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Styles ───────────────────────────────────────────────────────────────
  const wrapStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#040404',
    overflow: 'hidden',
  };

  const canvasStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    cursor: 'grab',
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={wrapStyle}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <div style={{ position: 'relative', width: 48, height: 48 }}>
            {/* Central dot */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#7C3AED',
                transform: 'translate(-50%,-50%)',
              }}
            />
            {/* Orbiting dot */}
            <div className="orbit-dot" style={{ top: '50%', left: '50%', marginTop: -3, marginLeft: -3 }} />
          </div>
          <p
            style={{
              color: 'rgba(255,255,255,0.40)',
              fontSize: 12,
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.06em',
            }}
          >
            Mapping knowledge space…
          </p>
        </div>
      </div>
    );
  }

  // ─── Empty state (< 2 nodes) ──────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div style={wrapStyle}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          {/* Pulsing centre point + orbiting dot */}
          <div style={{ position: 'relative', width: 60, height: 60 }}>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#7C3AED',
                transform: 'translate(-50%,-50%)',
                boxShadow: '0 0 16px #7C3AED, 0 0 32px rgba(124,58,237,0.4)',
                animation: 'accent-glow-pulse 2s ease-in-out infinite',
              }}
            />
            <div
              className="orbit-dot"
              style={{ top: '50%', left: '50%', marginTop: -3, marginLeft: -3 }}
            />
          </div>

          <p
            style={{
              color: 'rgba(255,255,255,0.40)',
              fontSize: 13,
              textAlign: 'center',
              maxWidth: 280,
              lineHeight: 1.6,
            }}
          >
            Upload at least 2 documents to see your knowledge map emerge
          </p>
        </div>
      </div>
    );
  }

  // ─── Normal render ────────────────────────────────────────────────────────
  return (
    <div style={wrapStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      {/* Floating HTML label — pointer-events none so it doesn't block canvas */}
      <AnimatePresence>
        {hoverLabel && (
          <motion.div
            key={hoverLabel.node.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: hoverLabel.screenX,
              top: hoverLabel.screenY + 18,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              background: 'rgba(10,10,10,0.88)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(124,58,237,0.35)',
              borderRadius: 8,
              padding: '6px 12px',
              zIndex: 50,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: DOC_TYPE_COLORS[hoverLabel.node.type] ?? DEFAULT_COLOR,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.40)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {hoverLabel.node.type}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.90)', maxWidth: 180 }}>
              {hoverLabel.node.label}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.30)',
                marginTop: 2,
              }}
            >
              Click to open in chat
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-right info card on hover (slide-in panel) */}
      <AnimatePresence>
        {hoverLabel && (
          <motion.div
            key={`card-${hoverLabel.node.id}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(10,10,10,0.80)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '12px 16px',
              minWidth: 200,
              pointerEvents: 'none',
              zIndex: 40,
            }}
          >
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {hoverLabel.node.type}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
              {hoverLabel.node.label}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 6 }}>
              Click to open in chat
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend — top left */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(10,10,10,0.72)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 40,
        }}
      >
        {Object.entries(DOC_TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono, monospace)' }}>
              {type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
