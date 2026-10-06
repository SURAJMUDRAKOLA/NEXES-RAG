// src/components/insights/RelatedQuestions.tsx
// 3 clickable question pills — Section 3.4
'use client';

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface RelatedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export function RelatedQuestions({ questions, onSelect }: RelatedQuestionsProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!questions || questions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {questions.slice(0, 3).map((q, i) => (
        <button
          key={i}
          id={`related-q-${i}`}
          onClick={() => onSelect(q)}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: 'var(--r-md)',
            background: hoveredIdx === i ? 'var(--accent-dim)' : 'var(--bg-elevated)',
            border: `1px solid ${hoveredIdx === i ? 'var(--accent)' : 'var(--border)'}`,
            cursor: 'pointer',
            color: hoveredIdx === i ? 'var(--accent-light)' : 'var(--text-2)',
            fontSize: 'var(--size-xs)',
            textAlign: 'left',
            lineHeight: 1.4,
            transition: 'background var(--dur-base), border-color var(--dur-base), color var(--dur-base)',
          }}
        >
          <ChevronRight
            size={12}
            style={{
              flexShrink: 0,
              color: hoveredIdx === i ? 'var(--accent-light)' : 'var(--text-3)',
              transition: 'color var(--dur-base)',
            }}
          />
          <span>{q}</span>
        </button>
      ))}
    </div>
  );
}
