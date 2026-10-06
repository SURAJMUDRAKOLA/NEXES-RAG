'use client';
// src/app/(app)/map/page.tsx
// Section 3.5 — 3D Knowledge Map redesign per nexus_uiux_complete_part2.html

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { embeddingsApi } from '@/lib/api';
import { UMAPNode, DocType } from '@/types';
import { useRouter } from 'next/navigation';
import { ZoomIn, ZoomOut, RotateCcw, FileText, Presentation, FileType2, Image, Music } from 'lucide-react';

const AppShell = dynamic(
  () => import('@/components/layout/AppShell').then((m) => ({ default: m.AppShell })),
  { ssr: false }
);

const KnowledgeMap3D = dynamic(() => import('@/components/three/KnowledgeMap3D'), {
  ssr: false,
  loading: () => null,
});

// ── CSS keyframes injected once ─────────────────────────────────────────────
const ORBIT_KEYFRAMES = `
@keyframes nexus-orbit {
  from { transform: rotate(0deg) translateX(20px) rotate(0deg); }
  to   { transform: rotate(360deg) translateX(20px) rotate(-360deg); }
}
@keyframes nexus-orbit-pulse {
  0%, 100% { transform: rotate(0deg) translateX(20px) rotate(0deg) scale(1); opacity: 1; }
  50%       { transform: rotate(180deg) translateX(20px) rotate(-180deg) scale(0.7); opacity: 0.5; }
}
`;

// ── Doc-type color map ───────────────────────────────────────────────────────
const DOC_COLORS: Record<DocType, string> = {
  pdf:   '#EF4444',
  pptx:  '#F97316',
  docx:  '#3B82F6',
  image: '#14B8A6',
  audio: '#7C3AED',
  xlsx:  '#22C55E',
  video: '#EC4899',
  txt:   '#94A3B8',
  other: '#6B7280',
};

const DOC_LABELS: Partial<Record<DocType, string>> = {
  pdf:   'PDF',
  pptx:  'PPTX',
  docx:  'DOCX',
  image: 'Image',
  audio: 'Audio',
};

function DocTypeIcon({ type, color }: { type: DocType; color: string }) {
  const s = { width: 18, height: 18, color };
  switch (type) {
    case 'pptx':  return <Presentation style={s} />;
    case 'docx':  return <FileType2 style={s} />;
    case 'image': return <Image style={s} />;
    case 'audio': return <Music style={s} />;
    default:      return <FileText style={s} />;
  }
}

// ── Loading state ────────────────────────────────────────────────────────────
function MapLoading() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#040404',
    }}>
      {/* Orbiting dot */}
      <div style={{ position: 'relative', width: 40, height: 40, marginBottom: 20 }}>
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 4, height: 4,
          borderRadius: '50%',
          background: 'rgba(124,58,237,0.4)',
          transform: 'translate(-50%,-50%)',
        }} />
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 6, height: 6,
          borderRadius: '50%',
          background: '#7C3AED',
          marginTop: -3, marginLeft: -3,
          animation: 'nexus-orbit 1.5s linear infinite',
          boxShadow: '0 0 8px rgba(124,58,237,0.8)',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
        fontSize: 14,
        color: 'rgba(255,255,255,0.40)',
        letterSpacing: '0.02em',
      }}>
        Calculating knowledge map...
      </span>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function MapEmpty() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#040404',
    }}>
      {/* Pulsing orbit */}
      <div style={{ position: 'relative', width: 48, height: 48, marginBottom: 24 }}>
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 6, height: 6,
          borderRadius: '50%',
          background: 'rgba(124,58,237,0.5)',
          transform: 'translate(-50%,-50%)',
          boxShadow: '0 0 12px rgba(124,58,237,0.4)',
        }} />
        {/* Orbit ring */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '1px solid rgba(124,58,237,0.20)',
          animation: 'nexus-orbit-pulse 2s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 5, height: 5,
          borderRadius: '50%',
          background: '#A78BFA',
          marginTop: -2.5, marginLeft: -2.5,
          animation: 'nexus-orbit 2.5s linear infinite',
          opacity: 0.7,
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
        fontSize: 15,
        color: 'rgba(255,255,255,0.40)',
        textAlign: 'center',
        maxWidth: 320,
        lineHeight: 1.6,
      }}>
        Upload at least 2 documents to see your knowledge map emerge
      </span>
    </div>
  );
}

// ── Hover panel ──────────────────────────────────────────────────────────────
function HoverPanel({ node, onClose }: { node: UMAPNode; onClose: () => void }) {
  const router = useRouter();
  const color = DOC_COLORS[node.type] ?? '#7C3AED';

  return (
    <motion.div
      key={node.id}
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0, 0.5, 0.5, 1] }}
      style={{
        position: 'absolute',
        right: 0, top: 0, bottom: 0,
        width: 280,
        background: 'rgba(10,10,10,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        gap: 16,
        zIndex: 30,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <DocTypeIcon type={node.type} color={color} />
        <span style={{
          fontSize: 16, fontWeight: 600,
          color: 'rgba(255,255,255,1)',
          flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.label}
        </span>
      </div>

      {/* Type badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        border: `0.5px solid ${color}40`,
        background: `${color}10`,
        fontSize: 10,
        color,
        width: 'fit-content',
        fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {node.type.toUpperCase()}
      </div>

      {/* Summary placeholder */}
      <p style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.55)',
        lineHeight: 1.65,
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        This document is part of your knowledge base. Click below to explore it in chat.
      </p>

      {/* Metadata row */}
      <div style={{
        display: 'flex', gap: 12,
        fontSize: 11,
        color: 'rgba(255,255,255,0.30)',
        fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
      }}>
        <span>ID: {node.id.slice(0, 8)}</span>
      </div>

      {/* Topic pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {['Knowledge', node.type.toUpperCase(), 'Indexed'].map((t) => (
          <span key={t} style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 999,
            border: '0.5px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.40)',
          }}>{t}</span>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* CTA button */}
      <button
        onClick={() => router.push(`/chat?doc=${node.id}`)}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
          border: 'none',
          borderRadius: 8,
          color: 'rgba(255,255,255,1)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: 'inherit',
        }}
      >
        Open in chat →
      </button>

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.30)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: 4,
        }}
      >
        ×
      </button>
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MapPage() {
  const [nodes, setNodes] = useState<UMAPNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState<UMAPNode | null>(null);
  const [zoomSignal, setZoomSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    embeddingsApi.umap()
      .then((res) => setNodes(res.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleNodeClick = useCallback((node: UMAPNode) => {
    setSelectedNode(node);
  }, []);

  const edgeCount = Math.max(0, nodes.length - 1);

  return (
    <>
      {/* Inject keyframes */}
      <style>{ORBIT_KEYFRAMES}</style>

      <AppShell activeRoute="/map">
        {/* Full-viewport container */}
        <div style={{
          position: 'relative',
          height: '100vh',
          overflow: 'hidden',
          background: '#040404',
        }}>

          {/* ── Top bar overlay ── */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            zIndex: 20,
            pointerEvents: 'none',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
              fontSize: 11,
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.04em',
            }}>
              NEXUS &nbsp;/&nbsp; Knowledge Map
            </span>
            <button style={{
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 9,
              color: 'rgba(255,255,255,0.40)',
              cursor: 'pointer',
              pointerEvents: 'all',
              fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
            }}>
              ⌘K search
            </button>
          </div>

          {/* ── Controls overlay (top-right) ── */}
          <div style={{
            position: 'absolute',
            top: 48, right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 20,
          }}>
            {[
              { icon: <ZoomIn size={14} />, label: 'Zoom in',  onClick: () => setZoomSignal((z) => z + 1)  },
              { icon: <ZoomOut size={14} />, label: 'Zoom out', onClick: () => setZoomSignal((z) => z - 1)  },
              { icon: <RotateCcw size={14} />, label: 'Reset',  onClick: () => setResetSignal((r) => r + 1) },
            ].map(({ icon, label, onClick }) => (
              <button
                key={label}
                aria-label={label}
                onClick={onClick}
                title={label}
                style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '0.5px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.50)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* ── Legend (bottom-left) ── */}
          <div style={{
            position: 'absolute',
            bottom: 16, left: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            zIndex: 20,
            pointerEvents: 'none',
          }}>
            {(Object.entries(DOC_LABELS) as [DocType, string][]).map(([type, label]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: DOC_COLORS[type],
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.25)',
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Stats (bottom-right) ── */}
          <div style={{
            position: 'absolute',
            bottom: 16, right: 16,
            zIndex: 20,
            pointerEvents: 'none',
          }}>
            {!loading && !error && (
              <span style={{
                fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
                fontSize: 9,
                color: 'rgba(255,255,255,0.20)',
              }}>
                {nodes.length} nodes · {edgeCount} edges
              </span>
            )}
          </div>

          {/* ── Canvas states ── */}
          {loading && <MapLoading />}

          {error && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#040404',
            }}>
              <span style={{ color: '#EF4444', fontSize: 14 }}>{error}</span>
            </div>
          )}

          {!loading && !error && nodes.length < 2 && <MapEmpty />}

          {!loading && !error && nodes.length >= 2 && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <KnowledgeMap3D
                nodes={nodes}
                onNodeClick={handleNodeClick}
              />
            </div>
          )}

          {/* ── Hover panel ── */}
          <AnimatePresence>
            {selectedNode && (
              <HoverPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </AppShell>
    </>
  );
}
