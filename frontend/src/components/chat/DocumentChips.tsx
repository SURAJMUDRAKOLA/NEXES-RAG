// src/components/chat/DocumentChips.tsx
// Feature 15 — Active document chips in chat header
// Shows which documents are in scope + allows toggling individual docs
'use client';

import { FileText, X, FileImage, File } from 'lucide-react';

interface Document {
  id:       string;
  name:     string;
  doc_type: string;
  status:   string;
}

interface DocumentChipsProps {
  documents:      Document[];
  selectedDocIds: string[];
  onToggle:       (docId: string) => void;
}

function getDocIcon(doc_type: string) {
  if (doc_type === 'pdf')   return <FileText  size={11} />;
  if (doc_type === 'image') return <FileImage size={11} />;
  return <File size={11} />;
}

function getDocColor(doc_type: string): string {
  switch (doc_type) {
    case 'pdf':   return '#F87171';
    case 'pptx':  return '#FB923C';
    case 'docx':  return '#60A5FA';
    case 'xlsx':  return '#34D399';
    case 'image': return '#A78BFA';
    default:      return 'rgba(255,255,255,0.5)';
  }
}

export function DocumentChips({
  documents,
  selectedDocIds,
  onToggle,
}: DocumentChipsProps) {
  const readyDocs = documents.filter((d) => d.status === 'ready');
  if (readyDocs.length === 0) return null;

  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '6px',
        flexWrap:   'wrap',
        padding:    '8px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(255,255,255,0.015)',
      }}
    >
      <span
        style={{
          fontSize:    '11px',
          color:       'rgba(255,255,255,0.3)',
          fontWeight:  500,
          letterSpacing: '0.05em',
          flexShrink:  0,
          textTransform: 'uppercase',
        }}
      >
        Docs:
      </span>

      {readyDocs.map((doc) => {
        const isActive = selectedDocIds.includes(doc.id);
        const color    = getDocColor(doc.doc_type);
        return (
          <button
            key={doc.id}
            id={`doc-chip-${doc.id}`}
            onClick={() => onToggle(doc.id)}
            title={isActive ? `Remove ${doc.name} from scope` : `Add ${doc.name} to scope`}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '5px',
              padding:      '3px 9px 3px 7px',
              background:   isActive ? `rgba(${hexToRgb(color)},0.12)` : 'rgba(255,255,255,0.04)',
              border:       `1px solid ${isActive ? `rgba(${hexToRgb(color)},0.35)` : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '6px',
              color:        isActive ? color : 'rgba(255,255,255,0.4)',
              fontSize:     '12px',
              fontFamily:   'var(--font)',
              cursor:       'pointer',
              transition:   'all 150ms ease',
              maxWidth:     '150px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)';
              }
            }}
          >
            <span style={{ color: isActive ? color : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
              {getDocIcon(doc.doc_type)}
            </span>
            <span
              style={{
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                maxWidth:     '110px',
              }}
            >
              {doc.name.replace(/\.[^/.]+$/, '')}
            </span>
            {isActive && (
              <X
                size={10}
                style={{ flexShrink: 0, opacity: 0.6 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Convert hex (#RRGGBB) to "R,G,B" string for rgba() */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255,255,255';
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ].join(',');
}
