// src/components/chat/CitationBadge.tsx
// Clickable [N] citation badge with popover — Section 3.4
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText } from 'lucide-react';
import { SourceChunk } from '@/types';
import { CITATION_SPRING } from '@/lib/variants';
import { truncate } from '@/lib/utils';

interface CitationBadgeProps {
  index: number;
  chunk: SourceChunk;
}

export function CitationBadge({ index, chunk }: CitationBadgeProps) {
  const [open, setOpen]   = useState(false);
  const badgeRef          = useRef<HTMLSpanElement | null>(null);
  const popoverRef        = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        badgeRef.current && !badgeRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pageRef = chunk.page_num
    ? `p. ${chunk.page_num}`
    : chunk.slide_num
    ? `slide ${chunk.slide_num}`
    : null;

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <motion.span
        ref={badgeRef}
        variants={CITATION_SPRING}
        initial="initial"
        animate="animate"
        className="citation-badge"
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        aria-label={`Source ${index}: ${chunk.doc_name}`}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((v) => !v)}
      >
        {index}
      </motion.span>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
            exit={{ opacity: 0, scale: 0.95, y: 4, transition: { duration: 0.1 } }}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '280px',
              background: 'rgba(22, 22, 22, 0.97)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border-hover)',
              borderRadius: 'var(--r-lg)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              padding: '12px',
              zIndex: 100,
            }}
          >
            {/* Arrow */}
            <div
              style={{
                position: 'absolute',
                bottom: '-5px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '10px',
                height: '10px',
                background: 'var(--bg-elevated)',
                borderRight: '1px solid var(--border-hover)',
                borderBottom: '1px solid var(--border-hover)',
              }}
            />

            {/* Doc name */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '6px',
              }}
            >
              <FileText size={13} color="var(--accent-light)" />
              <span
                style={{
                  fontSize: 'var(--size-xs)',
                  color: 'var(--accent-light)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {chunk.doc_name}
              </span>
              {pageRef && (
                <span
                  style={{
                    fontSize: 'var(--size-xs)',
                    color: 'var(--text-3)',
                    marginLeft: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pageRef}
                </span>
              )}
            </div>

            {/* Excerpt */}
            <p
              style={{
                fontSize: 'var(--size-xs)',
                color: 'var(--text-2)',
                lineHeight: 1.5,
                fontFamily: 'var(--font)',
                borderLeft: '2px solid var(--accent-dim)',
                paddingLeft: '8px',
              }}
            >
              {truncate(chunk.snippet ?? chunk.content, 180)}
            </p>

            {/* Score */}
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>Relevance</span>
              <div
                style={{
                  flex: 1,
                  height: '3px',
                  borderRadius: 'var(--r-full)',
                  background: 'var(--bg-active)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(chunk.score ?? chunk.similarity) * 100}%`,
                    borderRadius: 'var(--r-full)',
                    background:
                      (chunk.score ?? chunk.similarity) >= 0.8
                        ? 'var(--success)'
                        : (chunk.score ?? chunk.similarity) >= 0.6
                        ? 'var(--warning)'
                        : 'var(--error)',
                    transition: 'width 0.4s var(--ease-out)',
                  }}
                />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {((chunk.score ?? chunk.similarity) * 100).toFixed(0)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
