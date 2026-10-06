// src/components/upload/FileCard.tsx
// Individual file status card — Section 3.3 blueprint
'use client';

import { motion } from 'framer-motion';
import { X, FileText, FileImage, FileAudio, Table2, Presentation, File } from 'lucide-react';
import { Document, UploadingFile, DocStatus, DocType } from '@/types';
import { formatBytes, getDocTypeColor, truncate } from '@/lib/utils';
import { FILE_CARD_ENTER } from '@/lib/variants';
import { useFileStore } from '@/store/useFileStore';

// ── Helpers ──────────────────────────────────────

function DocIcon({ type }: { type: DocType }) {
  const color = getDocTypeColor(type);
  const size = 18;
  switch (type) {
    case 'pdf':   return <FileText  size={size} color={color} />;
    case 'pptx':  return <Presentation size={size} color={color} />;
    case 'docx':  return <FileText  size={size} color={color} />;
    case 'image': return <FileImage size={size} color={color} />;
    case 'audio': return <FileAudio size={size} color={color} />;
    case 'xlsx':  return <Table2   size={size} color={color} />;
    default:      return <File     size={size} color={color} />;
  }
}

const STATUS_META: Record<
  DocStatus,
  { label: string; pulse: boolean; cssClass: string }
> = {
  queued:    { label: 'Queued',     pulse: false, cssClass: 'queued' },
  parsing:   { label: 'Parsing',    pulse: true,  cssClass: 'parsing' },
  chunking:  { label: 'Chunking',   pulse: true,  cssClass: 'chunking' },
  embedding: { label: 'Embedding',  pulse: true,  cssClass: 'embedding' },
  ready:     { label: 'Ready',      pulse: false, cssClass: 'ready' },
  error:     { label: 'Error',      pulse: false, cssClass: 'error' },
};

// SVG progress ring
function ProgressRing({ progress, status }: { progress: number; status: DocStatus }) {
  const R = 12;
  const C = 2 * Math.PI * R;
  const offset = C - (progress / 100) * C;

  const colorMap: Record<DocStatus, string> = {
    queued:    'var(--status-queued)',
    parsing:   'var(--status-parsing)',
    chunking:  'var(--status-chunking)',
    embedding: 'var(--status-embedding)',
    ready:     'var(--status-ready)',
    error:     'var(--status-error)',
  };

  if (status === 'ready') {
    // Filled circle for done
    return (
      <svg width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r={R} fill="none" stroke="var(--success)" strokeWidth="2" />
        <circle cx="15" cy="15" r={R} fill="none" stroke="var(--success)" strokeWidth="2"
          strokeDasharray={`${C}`} strokeDashoffset="0"
          strokeLinecap="round" transform="rotate(-90 15 15)" />
        <polyline points="10,15 13,18 20,11" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="30" height="30" viewBox="0 0 30 30">
      {/* Track */}
      <circle cx="15" cy="15" r={R} fill="none" stroke="var(--border)" strokeWidth="2" />
      {/* Progress */}
      <circle
        cx="15" cy="15" r={R}
        fill="none"
        stroke={colorMap[status]}
        strokeWidth="2"
        strokeDasharray={`${C}`}
        strokeDashoffset={`${offset}`}
        strokeLinecap="round"
        transform="rotate(-90 15 15)"
        style={{ transition: 'stroke-dashoffset 0.4s var(--ease-out)' }}
      />
    </svg>
  );
}

// ── Component ────────────────────────────────────

interface FileCardProps {
  item: Document | UploadingFile;
}

export function FileCard({ item }: FileCardProps) {
  const removeDocument     = useFileStore((s) => s.removeDocument);
  const removeUploadingFile = useFileStore((s) => s.removeUploadingFile);

  // Normalise shape
  const isDocument = 'doc_type' in item;
  const name       = isDocument ? item.original_name ?? item.name : item.file.name;
  const docType    = isDocument
    ? item.doc_type
    : (item.file.name.split('.').pop()?.toLowerCase() as DocType) ?? 'pdf';
  const status     = item.status;
  const progress   = item.progress;
  const size       = isDocument ? item.file_size : item.file.size;

  const meta = STATUS_META[status] ?? STATUS_META.queued;

  const handleRemove = () => {
    if (isDocument) removeDocument(item.id);
    else removeUploadingFile(item.id);
  };

  return (
    <motion.div
      layoutId={`file-card-${item.id}`}
      variants={FILE_CARD_ENTER}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Doc type icon */}
      <DocIcon type={docType} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 'var(--size-sm)',
            color: 'var(--text-1)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {truncate(name, 42)}
        </p>
        <p style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)', marginTop: '2px' }}>
          {size ? formatBytes(size) : '—'}
        </p>
      </div>

      {/* Status badge */}
      <span className={`status-badge ${meta.cssClass}`}>
        {meta.pulse && <span className={`status-dot pulse`} />}
        {meta.label}
      </span>

      {/* Progress ring */}
      <ProgressRing progress={progress} status={status} />

      {/* Remove button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleRemove}
        aria-label="Remove file"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-3)',
          padding: '4px',
          borderRadius: 'var(--r-sm)',
          transition: 'color var(--dur-base)',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--error)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-3)')}
      >
        <X size={14} />
      </motion.button>
    </motion.div>
  );
}
