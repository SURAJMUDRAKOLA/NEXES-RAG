// src/components/chat/TypingIndicator.tsx
// Three-dot wave animation shown while assistant is generating a response
'use client';

import { motion } from 'framer-motion';

const DOT_VARIANTS = {
  animate: (i: number) => ({
    y: [0, -6, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut' as const,
      delay: i * 0.12,
    },
  }),
};

export function TypingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '4px 0',
        width: '100%',
      }}
    >
      {/* N-icon matching assistant bubble */}
      <div
        style={{
          flexShrink: 0,
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'rgba(124,58,237,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: '#A78BFA',
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          N
        </span>
      </div>

      {/* Three dot wave */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          height: '28px',
          paddingTop: '4px',
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            custom={i}
            animate="animate"
            variants={DOT_VARIANTS}
            style={{
              display: 'block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'rgba(124,58,237,0.7)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
