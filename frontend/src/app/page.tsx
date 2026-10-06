'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, MessageSquare, Zap, GraduationCap, BarChart3 } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';

// Three.js particle field — SSR false (WebGL)
const ParticleField = dynamic(
  () => import('@/components/landing/ParticleField'),
  { ssr: false, loading: () => null }
);

// Cosmic ring + aurora blobs (no canvas stars — Three.js handles particles)
const CosmicBackground = dynamic(
  () => import('@/components/landing/CosmicBackground'),
  { ssr: false, loading: () => null }
);

// Auth modal
const AuthModal = dynamic(
  () => import('@/components/landing/AuthModal'),
  { ssr: false }
);

// ── Feature cards data ────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <MessageSquare size={18} />, color: '#a78bfa', bg: 'rgba(124,58,237,0.18)', title: 'Chat with Any Doc', desc: 'PDF, DOCX, images, audio — ask anything.' },
  { icon: <Zap size={18} />,           color: '#60a5fa', bg: 'rgba(59,130,246,0.18)', title: 'Instant Summaries', desc: 'Extract key insights in seconds.' },
  { icon: <GraduationCap size={18} />, color: '#f472b6', bg: 'rgba(236,72,153,0.18)', title: 'Quizzes & Flashcards', desc: 'Active learning from any content.' },
  { icon: <BarChart3 size={18} />,     color: '#4ade80', bg: 'rgba(34,197,94,0.18)',  title: 'Deep Analysis', desc: 'Patterns across all your files.' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { authModalOpen, setAuthModalOpen } = useUIStore();
  const [ready, setReady] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const target = useRef({ x: 0.5, y: 0.5 });
  const raf = useRef<number>(0);

  // Smooth parallax mouse
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
    };
    const tick = () => {
      setMouse((p) => ({
        x: p.x + (target.current.x - p.x) * 0.06,
        y: p.y + (target.current.y - p.y) * 0.06,
      }));
      raf.current = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    raf.current = requestAnimationFrame(tick);
    setTimeout(() => setReady(true), 100);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf.current); };
  }, []);

  const openAuth = () => { setBlurred(true); setTimeout(() => setAuthModalOpen(true), 120); };
  const closeAuth = () => { setAuthModalOpen(false); setTimeout(() => setBlurred(false), 280); };

  const px = (mouse.x - 0.5) * 22;
  const py = (mouse.y - 0.5) * 14;
  const hx = (mouse.x - 0.5) * 6;
  const hy = (mouse.y - 0.5) * 4;

  return (
    <div style={{ minHeight: '100vh', background: '#030205', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

      {/* ── Background scene: Three.js particles + CosmicBackground ring/auroras ── */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 0,
          transform: `translate(${px}px, ${py}px) scale(1.05)`,
          filter: blurred ? 'blur(14px) brightness(0.4)' : 'none',
          transition: 'filter 400ms ease',
          willChange: 'transform, filter',
        }}
      >
        {/* Layer 1: Three.js fast particle field (stars + constellation lines + torus ring) */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <ParticleField />
        </div>

        {/* Layer 2: CosmicBackground — SVG orbital ring + aurora blobs on top of particles */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
          <CosmicBackground />
        </div>
      </div>

      {/* ── Top nav ── */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 40px', zIndex: 20, pointerEvents: 'none',
        }}
      >
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, letterSpacing: '0.20em', color: 'rgba(255,255,255,0.95)' }}>
          NEXUS
        </span>
      </motion.nav>

      {/* ── Hero ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: '170px 24px 52px',
        transform: `translate(${hx}px, ${hy}px)`,
        transition: 'transform 0.1s linear',
        maxWidth: 900, width: '100%',
      }}>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '7px 18px',
            background: 'rgba(124,58,237,0.14)',
            border: '1px solid rgba(167,139,250,0.30)',
            borderRadius: 9999, fontSize: 11,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'rgba(196,181,253,0.90)', marginBottom: 30,
          }}
        >
          <Sparkles size={11} />
          AI Knowledge Workspace
        </motion.div>

        {/* Wordmark — letter by letter */}
        <div style={{
          display: 'flex',
          fontSize: 'clamp(78px, 13vw, 160px)',
          fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.9,
          marginBottom: 30,
          filter: 'drop-shadow(0 0 80px rgba(124,58,237,0.55))',
        }}>
          {['N','E','X','U','S'].map((c, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 32, filter: 'blur(20px)' }}
              animate={ready ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
              transition={{ duration: 1.0, delay: 0.2 + i * 0.08, ease: [0.19, 1, 0.22, 1] }}
              style={{
                background: 'linear-gradient(178deg, #f5f3ff 0%, #ddd6fe 28%, #c4b5fd 50%, #a78bfa 68%, #7c3aed 85%, #4c1d95 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                display: 'inline-block',
              }}
            >
              {c}
            </motion.span>
          ))}
        </div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.78 }}
          style={{ fontSize: 'clamp(17px, 2.4vw, 22px)', fontWeight: 400, color: 'rgba(255,255,255,0.58)', margin: '0 0 8px', lineHeight: 1.45 }}
        >
          Where Documents Become{' '}
          <span style={{ color: '#c4b5fd', fontWeight: 500 }}>Intelligence.</span>
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 1.0 }}
          style={{ fontSize: 14, color: 'rgba(255,255,255,0.32)', margin: '0 0 44px' }}
        >
          Upload any file — PDF, DOCX, image, audio — and chat with it instantly.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 1.15 }}
        >
          <CtaButton onClick={openAuth} />
        </motion.div>
      </div>

      {/* ── Feature cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        animate={ready ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, delay: 1.5 }}
        style={{
          position: 'relative', zIndex: 10,
          width: '90%', maxWidth: 1080, margin: '0 auto 100px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20, overflow: 'hidden',
        }}
      >
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.title} feature={f} index={i} last={i === FEATURES.length - 1} />
        ))}
      </motion.div>

      {/* Auth modal */}
      <AnimatePresence>
        {authModalOpen && <AuthModal onClose={closeAuth} />}
      </AnimatePresence>
    </div>
  );
}

// ── CTA Button ────────────────────────────────────────────────────────────────
function CtaButton({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 12,
        padding: '17px 44px',
        background: hov
          ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
          : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
        border: '1px solid rgba(196,181,253,0.30)',
        borderRadius: 9999,
        fontSize: 16, fontWeight: 600, color: '#fff',
        cursor: 'pointer', letterSpacing: '0.01em',
        boxShadow: hov
          ? '0 0 0 4px rgba(124,58,237,0.22), 0 10px 50px rgba(124,58,237,0.65)'
          : '0 0 0 1px rgba(124,58,237,0.15), 0 6px 30px rgba(124,58,237,0.45)',
        transform: hov ? 'translateY(-3px) scale(1.04)' : 'translateY(0) scale(1)',
        transition: 'all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        fontFamily: 'var(--font-sans)',
        animation: hov ? 'none' : 'cta-breathe 3.5s ease-in-out infinite',
      }}
    >
      Get Started Free
      <ArrowRight size={16} style={{ transform: hov ? 'translateX(4px)' : 'translateX(0)', transition: 'transform 200ms ease' }} />
    </button>
  );
}

// ── Feature Card ──────────────────────────────────────────────────────────────
function FeatureCard({ feature, index, last }: { feature: typeof FEATURES[0]; index: number; last: boolean }) {
  const [hov, setHov] = useState(false);
  const floatAnims = [
    'card-float-a 7s ease-in-out infinite',
    'card-float-b 8.5s ease-in-out 0.8s infinite',
    'card-float-c 6.5s ease-in-out 0.4s infinite',
    'card-float-d 9s ease-in-out 1.2s infinite',
  ];
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '26px 22px',
        borderRight: !last ? '1px solid rgba(255,255,255,0.06)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 14,
        animation: floatAnims[index],
        background: hov ? 'rgba(124,58,237,0.07)' : 'transparent',
        transition: 'background 200ms ease', cursor: 'default',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, background: feature.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: feature.color }}>
        {feature.icon}
      </div>
      <div>
        <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.90)' }}>{feature.title}</p>
        <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.36)', lineHeight: 1.55 }}>{feature.desc}</p>
      </div>
    </div>
  );
}
