// src/components/chat/FollowUpChips.tsx
// Feature 11 + 15 — Follow-up suggestion chips shown after AI response
// Appears below the last assistant message with animated entrance
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface FollowUpChipsProps {
  questions:  string[];
  onSelect:   (q: string) => void;
  isVisible:  boolean;
}

export function FollowUpChips({ questions, onSelect, isVisible }: FollowUpChipsProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.25, ease: [0.0, 0.5, 0.5, 1.0] }}
          style={{
            display:    'flex',
            flexWrap:   'wrap',
            gap:        '8px',
            marginTop:  '12px',
            paddingLeft: '0px',
          }}
        >
          <div
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         '5px',
              width:       '100%',
              color:       'rgba(255,255,255,0.25)',
              fontSize:    '11px',
              marginBottom: '2px',
            }}
          >
            <Sparkles size={11} />
            Follow-up questions
          </div>

          {questions.slice(0, 4).map((q, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              onClick={() => onSelect(q)}
              style={{
                padding:      '7px 14px',
                background:   'rgba(124,58,237,0.06)',
                border:       '1px solid rgba(124,58,237,0.18)',
                borderRadius: '9999px',
                color:        'rgba(167,139,250,0.8)',
                fontSize:     '12.5px',
                cursor:       'pointer',
                fontFamily:   'var(--font)',
                textAlign:    'left',
                transition:   'all 140ms ease',
                lineHeight:   1.4,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background    = 'rgba(124,58,237,0.14)';
                el.style.borderColor   = 'rgba(124,58,237,0.40)';
                el.style.color         = '#C4B5FD';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background    = 'rgba(124,58,237,0.06)';
                el.style.borderColor   = 'rgba(124,58,237,0.18)';
                el.style.color         = 'rgba(167,139,250,0.8)';
              }}
            >
              {q}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
