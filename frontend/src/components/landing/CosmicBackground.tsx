'use client';
// CosmicBackground — SVG orbital ring + aurora blobs
// Canvas stars removed — Three.js ParticleField handles that layer now

export default function CosmicBackground() {
  return (
    <>
      {/* ── SVG Orbital Ring ── */}
      <svg
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -62%)',
          width: '120vw',
          height: '120vw',
          maxWidth: 1600,
          maxHeight: 1600,
          zIndex: 1,
          pointerEvents: 'none',
        }}
        viewBox="0 0 1000 1000"
        overflow="visible"
      >
        <defs>
          <filter id="ringBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="ringGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        <g className="animate-ring-rotate" style={{ transformOrigin: '500px 500px' }}>
          {/* Outer glow halo */}
          <circle
            cx="500" cy="500" r="378"
            fill="none"
            stroke="rgba(124,58,237,0.28)"
            strokeWidth="90"
            filter="url(#ringGlow)"
          />
          {/* Primary ring line */}
          <circle
            cx="500" cy="500" r="378"
            fill="none"
            stroke="rgba(196,181,253,0.72)"
            strokeWidth="1.5"
            filter="url(#ringBlur)"
            strokeDasharray="1100 800"
          />
          {/* Secondary faint arc */}
          <circle
            cx="500" cy="500" r="360"
            fill="none"
            stroke="rgba(124,58,237,0.15)"
            strokeWidth="0.8"
            strokeDasharray="300 1400"
            strokeDashoffset="200"
          />
        </g>

        {/* Static outer ring */}
        <circle
          cx="500" cy="500" r="430"
          fill="none"
          stroke="rgba(124,58,237,0.06)"
          strokeWidth="0.5"
        />
      </svg>

      {/* ── Aurora A — blue/indigo left ── */}
      <div
        style={{
          position: 'absolute',
          top: '-5%',
          left: '-20%',
          width: '75vw',
          height: '75vw',
          maxWidth: 900,
          maxHeight: 900,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.52) 0%, rgba(59,130,246,0.28) 40%, transparent 70%)',
          filter: 'blur(90px)',
          mixBlendMode: 'screen',
          animation: 'aurora-drift-a 90s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* ── Aurora B — violet right ── */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-20%',
          width: '70vw',
          height: '70vw',
          maxWidth: 850,
          maxHeight: 850,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(147,51,234,0.58) 0%, rgba(124,58,237,0.28) 45%, transparent 70%)',
          filter: 'blur(110px)',
          mixBlendMode: 'screen',
          animation: 'aurora-drift-b 110s ease-in-out infinite alternate',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* ── Aurora C — deep violet center bloom ── */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '55vw',
          height: '55vw',
          maxWidth: 700,
          maxHeight: 700,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(109,40,217,0.45) 0%, rgba(76,29,149,0.20) 50%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'bloom-breathe 10s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* ── Floor bloom ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90vw',
          height: '45vh',
          background: 'radial-gradient(ellipse at center bottom, rgba(147,51,234,0.55) 0%, rgba(109,40,217,0.20) 40%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'bloom-breathe 8s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />

      {/* ── Floor reflection gradient ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '35vh',
          background: 'linear-gradient(to top, rgba(109,40,217,0.18) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />
    </>
  );
}
