// src/components/insights/SourceCard.tsx
// Source chunk display card — Section 3.4
'use client';

import { useState } from 'react';
import { FileText, FileImage, FileAudio, Table2, Presentation, File } from 'lucide-react';
import { SourceChunk } from '@/types';
import { getDocTypeColor } from '@/lib/utils';
import { DocType } from '@/types';

function inferType(docName: string): DocType {
  const ext = docName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf')  return 'pdf';
  if (ext === 'pptx') return 'pptx';
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx') return 'xlsx';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '')) return 'image';
  if (['mp3', 'wav', 'm4a'].includes(ext ?? '')) return 'audio';
  return 'pdf';
}

function DocIcon({ docName }: { docName: string }) {
  const type  = inferType(docName);
  const color = getDocTypeColor(type);
  const size  = 16;
  switch (type) {
    case 'pdf':   return <FileText     size={size} color={color} />;
    case 'pptx':  return <Presentation size={size} color={color} />;
    case 'docx':  return <FileText     size={size} color={color} />;
    case 'image': return <FileImage    size={size} color={color} />;
    case 'audio': return <FileAudio    size={size} color={color} />;
    case 'xlsx':  return <Table2       size={size} color={color} />;
    default:      return <File         size={size} color={color} />;
  }
}

function scoreColor(score: number) {
  if (score >= 0.8) return 'var(--success)';
  if (score >= 0.6) return 'var(--warning)';
  return 'var(--error)';
}

interface SourceCardProps {
  chunk: SourceChunk;
  index?: number;
}

export function SourceCard({ chunk, index }: SourceCardProps) {
  const [hovered, setHovered] = useState(false);

  const pageRef = chunk.page_num
    ? `p. ${chunk.page_num}`
    : chunk.slide_num
    ? `slide ${chunk.slide_num}`
    : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)',
        background: hovered ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        transition: 'background var(--dur-base), border-color var(--dur-base)',
        borderColor: hovered ? 'var(--border-hover)' : 'var(--border)',
        cursor: 'default',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '6px',
        }}
      >
        {index !== undefined && (
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-light)',
              fontWeight: 700,
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--r-sm)',
              padding: '0 5px',
              lineHeight: '16px',
              flexShrink: 0,
            }}
          >
            {index}
          </span>
        )}
        <DocIcon docName={chunk.doc_name ?? ''} />
        <span
          style={{
            fontSize: 'var(--size-xs)',
            color: 'var(--text-1)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {chunk.doc_name ?? chunk.content.slice(0, 40)}
        </span>
        {pageRef && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}
          >
            {pageRef}
          </span>
        )}
      </div>

      {/* Excerpt — 4-line clamp */}
      <p
        style={{
          fontSize: 'var(--size-xs)',
          color: 'var(--text-2)',
          lineHeight: 1.5,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 4,
          margin: '0 0 8px',
        }}
      >
        {chunk.snippet ?? chunk.content}
      </p>

      {/* Relevance score bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
          Relevance
        </span>
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
              background: scoreColor(chunk.score ?? chunk.similarity),
              transition: 'width 0.5s var(--ease-out)',
            }}
          />
        </div>
        <span
          style={{
            color: scoreColor(chunk.score ?? chunk.similarity),
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
        >
          {((chunk.score ?? chunk.similarity) * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
