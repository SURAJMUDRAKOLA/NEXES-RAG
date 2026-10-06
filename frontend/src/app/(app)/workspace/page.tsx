'use client';
// src/app/(app)/workspace/page.tsx
// Section 3.3 — Knowledge Workspace: upload + processing queue + file grid
// Redesigned per nexus_uiux_complete_part2.html

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useFileStore } from '@/store/useFileStore';
import { useDocumentRealtime } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { getDocTypeColor, formatRelativeTime } from '@/lib/utils';
import {
  ArrowRight,
  Trash2,
  Upload,
  Search,
  FolderOpen,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Document, DocType } from '@/types';

/* ─────────────────────────────────────────────
   Dynamic imports
───────────────────────────────────────────── */
const ProcessingQueue = dynamic(
  () => import('@/components/upload/ProcessingQueue').then((m) => ({ default: m.ProcessingQueue })),
  { ssr: false }
);
const AppShell = dynamic(
  () => import('@/components/layout/AppShell').then((m) => ({ default: m.AppShell })),
  { ssr: false }
);

/* ─────────────────────────────────────────────
   CSS injected once
───────────────────────────────────────────── */
const PAGE_CSS = `
@keyframes ws-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes ws-pulse-dot {
  0%, 100% { opacity: 1; }
  50%        { opacity: 0.4; }
}
.ws-card-actions {
  opacity: 0;
  transition: opacity 150ms ease;
}
.ws-file-card:hover .ws-card-actions {
  opacity: 1;
}
.ws-file-card {
  transition: border-color 150ms ease, background 150ms ease;
}
.ws-file-card:hover {
  border-color: rgba(255,255,255,0.20) !important;
  background: #161616 !important;
}
`;

function useInjectStyles(css: string) {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, [css]);
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const FORMAT_PILLS = ['PDF', 'PPTX', 'DOCX', 'PNG', 'MP3', 'MP4'];

function getDocTypeColorSpec(type: DocType): string {
  const map: Partial<Record<DocType, string>> = {
    pdf:   '#EF4444',
    pptx:  '#F97316',
    docx:  '#3B82F6',
    image: '#14B8A6',
    audio: '#7C3AED',
    xlsx:  '#8B5CF6',
  };
  return map[type] ?? '#8B5CF6';
}

/* ─────────────────────────────────────────────
   Skeleton card
───────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div
      style={{
        background: '#0f0f0f',
        border: '0.5px solid #1a1a1a',
        borderRadius: '12px',
        padding: '16px',
        height: '140px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* shimmer overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, #161616 0%, #1a1a1a 50%, #161616 100%)',
          backgroundSize: '200% 100%',
          animation: 'ws-shimmer 1.5s linear infinite',
          borderRadius: '12px',
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   File card
───────────────────────────────────────────── */
interface FileCardProps {
  doc: Document;
  onDelete: (id: string) => void;
  onOpenChat: (id: string) => void;
}

function FileCard({ doc, onDelete, onOpenChat }: FileCardProps) {
  const color = getDocTypeColorSpec(doc.doc_type);

  // Status dot color
  const dotColor =
    doc.status === 'ready'
      ? '#22C55E'
      : doc.status === 'error'
      ? '#EF4444'
      : '#F59E0B';

  const isPulsing = doc.status !== 'ready' && doc.status !== 'error';

  return (
    <div
      className="ws-file-card"
      style={{
        background: '#0f0f0f',
        border: '0.5px solid #1a1a1a',
        borderRadius: '12px',
        padding: '16px',
        height: '140px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'default',
      }}
    >
      {/* Top row: file type icon left + status dot right */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '10px',
        }}
      >
        {/* File type label as colored badge */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color,
              fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
              letterSpacing: '0.03em',
            }}
          >
            {doc.doc_type.toUpperCase()}
          </span>
        </div>

        {/* Status dot */}
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
            animation: isPulsing ? 'ws-pulse-dot 2s ease-in-out infinite' : 'none',
          }}
        />
      </div>

      {/* Filename */}
      <p
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#ffffff',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '4px',
        }}
      >
        {doc.name}
      </p>

      {/* Metadata */}
      <p
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.30)',
          fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
          marginBottom: 'auto',
        }}
      >
        {doc.page_count ? `${doc.page_count}p · ` : ''}
        {doc.indexed_at ? formatRelativeTime(doc.indexed_at) : '—'}
      </p>

      {/* Action buttons — fade in on hover via CSS class */}
      <div
        className="ws-card-actions"
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginTop: '8px',
        }}
      >
        <ActionBtn
          title="Open in chat"
          defaultColor="rgba(255,255,255,0.50)"
          hoverColor="#A78BFA"
          onClick={() => onOpenChat(doc.id)}
        >
          <ArrowRight size={13} />
        </ActionBtn>
        <ActionBtn
          title="Delete"
          defaultColor="rgba(255,255,255,0.30)"
          hoverColor="#EF4444"
          onClick={() => onDelete(doc.id)}
        >
          <Trash2 size={13} />
        </ActionBtn>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Action button helper
───────────────────────────────────────────── */
interface ActionBtnProps {
  title: string;
  defaultColor: string;
  hoverColor: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ActionBtn({ title, defaultColor, hoverColor, onClick, children }: ActionBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: hovered ? hoverColor : defaultColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px',
        borderRadius: '6px',
        transition: 'color 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Inline Drop Zone (replaces dynamic DropZone
   to allow drag-over state without re-render)
───────────────────────────────────────────── */
interface InlineDropZoneProps {
  onFilesAccepted: (files: File[]) => void;
}

function InlineDropZone({ onFilesAccepted }: InlineDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFilesAccepted(files);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFilesAccepted(files);
    e.target.value = '';
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        height: '160px',
        background: dragging ? 'rgba(124,58,237,0.04)' : '#0a0a0a',
        border: dragging
          ? '1.5px solid rgba(124,58,237,0.60)'
          : '1.5px dashed rgba(255,255,255,0.10)',
        borderRadius: '14px',
        margin: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 150ms ease, border-color 150ms ease',
        userSelect: 'none',
      }}
    >
      <Upload
        size={28}
        color={dragging ? 'rgba(124,58,237,0.60)' : 'rgba(255,255,255,0.20)'}
        style={{ marginBottom: '8px', transition: 'color 150ms ease' }}
      />
      <p
        style={{
          fontSize: '14px',
          color: dragging ? 'rgba(124,58,237,0.80)' : 'rgba(255,255,255,0.40)',
          marginBottom: '10px',
          transition: 'color 150ms ease',
        }}
      >
        Drop files here or click to browse
      </p>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {FORMAT_PILLS.map((f) => (
          <span
            key={f}
            style={{
              fontSize: '9px',
              padding: '1px 6px',
              borderRadius: '9999px',
              border: '0.5px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.30)',
            }}
          >
            {f}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
        accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg,.mp3,.mp4"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Empty state
───────────────────────────────────────────── */
interface EmptyStateProps {
  onUploadClick: () => void;
}

function EmptyState({ onUploadClick }: EmptyStateProps) {
  const [btnHover, setBtnHover] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: '12px',
      }}
    >
      <FolderOpen
        size={48}
        color="rgba(255,255,255,0.15)"
        style={{ marginBottom: '4px' }}
      />
      <p
        style={{
          fontSize: '16px',
          fontWeight: 500,
          color: '#ffffff',
          textAlign: 'center',
        }}
      >
        No documents yet
      </p>
      <p
        style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.40)',
          textAlign: 'center',
          maxWidth: '320px',
          lineHeight: 1.6,
        }}
      >
        Upload PDFs, presentations, images or audio to get started
      </p>
      <button
        onClick={onUploadClick}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        style={{
          marginTop: '8px',
          padding: '0 20px',
          height: '36px',
          background: btnHover ? '#6D28D9' : '#7C3AED',
          border: 'none',
          borderRadius: '8px',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'background 150ms ease',
        }}
      >
        <Upload size={14} />
        Upload your first file
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Top bar
───────────────────────────────────────────── */
interface TopBarProps {
  onUploadClick: () => void;
}

function TopBar({ onUploadClick }: TopBarProps) {
  const [searchHover, setSearchHover] = useState(false);
  const [uploadHover, setUploadHover] = useState(false);

  return (
    <div
      style={{
        height: '52px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      {/* Left: page title */}
      <span
        style={{
          fontSize: '15px',
          fontWeight: 500,
          color: '#ffffff',
        }}
      >
        Knowledge Base
      </span>

      {/* Right: search + upload */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Search icon button */}
        <button
          aria-label="Search"
          onMouseEnter={() => setSearchHover(true)}
          onMouseLeave={() => setSearchHover(false)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            background: searchHover ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: 'rgba(255,255,255,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
        >
          <Search size={16} />
        </button>

        {/* Upload ghost button */}
        <button
          onClick={onUploadClick}
          onMouseEnter={() => setUploadHover(true)}
          onMouseLeave={() => setUploadHover(false)}
          style={{
            height: '32px',
            padding: '0 12px',
            border: uploadHover
              ? '1px solid rgba(124,58,237,0.60)'
              : '1px dashed rgba(255,255,255,0.20)',
            borderRadius: '8px',
            background: 'transparent',
            color: uploadHover ? '#ffffff' : 'rgba(255,255,255,0.70)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'border-color 150ms ease, color 150ms ease',
          }}
        >
          <Upload size={13} />
          Upload
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function WorkspacePage() {
  const { documents, fetchDocuments, removeDocument, updateDocumentStatus, isLoading, uploadFile } =
    useFileStore();
  const { user } = useAuth();
  const router = useRouter();
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useInjectStyles(PAGE_CSS);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Subscribe to real-time document status updates from Supabase
  useDocumentRealtime(user?.id ?? null, (doc) => {
    updateDocumentStatus(doc.id, doc.status, doc.progress);
  });

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const hasNoDocuments = documents.length === 0 && !isLoading;

  const handleFilesAccepted = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        await uploadFile(file);
      }
    },
    [uploadFile]
  );

  const scrollToDropZone = useCallback(() => {
    dropZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <AppShell activeRoute="/workspace">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Top bar */}
        <TopBar onUploadClick={scrollToDropZone} />

        {/* Scrollable body */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0, 0.5, 0.5, 1] }}
            style={{ minHeight: '100%' }}
          >
            {/* Drop zone */}
            <div ref={dropZoneRef}>
              <InlineDropZone onFilesAccepted={handleFilesAccepted} />
            </div>

            {/* Processing Queue */}
            <div style={{ padding: '0 24px' }}>
              <ProcessingQueue />
            </div>

            {/* Loading skeleton */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    padding: '0 24px 24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* File grid */}
            {!isLoading && readyDocs.length > 0 && (
              <div
                style={{
                  padding: '0 24px 24px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '12px',
                }}
              >
                <AnimatePresence>
                  {readyDocs.map((doc) => (
                    <motion.div
                      key={doc.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, x: 40 }}
                      transition={{ duration: 0.18 }}
                    >
                      <FileCard
                        doc={doc}
                        onDelete={(id) => removeDocument(id)}
                        onOpenChat={(id) => router.push(`/chat?doc=${id}`)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && hasNoDocuments && (
              <EmptyState onUploadClick={scrollToDropZone} />
            )}
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
