// src/components/chat/SessionSidebar.tsx
// Left chat sidebar redesign — Section 3.4 Screen 3
'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FileText } from 'lucide-react';
import { useSessionStore } from '@/store/useSessionStore';
import { useChatStore } from '@/store/useChatStore';
import { useFileStore } from '@/store/useFileStore';
import { PANEL_SLIDE_LEFT } from '@/lib/variants';
import { groupSessionsByDate, truncate, formatRelativeTime } from '@/lib/utils';
import type { Session, Document } from '@/types';

export function SessionSidebar() {
  const sessions         = useSessionStore((s) => s.sessions);
  const activeSessionId  = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const createSession    = useSessionStore((s) => s.createSession);
  const clearMessages    = useChatStore((s) => s.clearMessages);
  const documents        = useFileStore((s) => s.documents);

  const grouped = useMemo(() => groupSessionsByDate(sessions), [sessions]);

  const handleNewChat = async () => {
    clearMessages();
    const session = await createSession();
    setActiveSession(session.id);
  };

  const handleSelectSession = (session: Session) => {
    setActiveSession(session.id);
    clearMessages();
  };

  const groupLabels = ['Today', 'Yesterday', 'Previous 7 days', 'Older'] as const;

  return (
    <motion.aside
      variants={PANEL_SLIDE_LEFT}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        width: '220px',
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#080808',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Top padding + New Chat button */}
      <div style={{ padding: '12px 8px' }}>
        <NewChatButton onClick={handleNewChat} />
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        <AnimatePresence initial={false}>
          {groupLabels.map((label) => {
            const items = grouped[label];
            if (!items || items.length === 0) return null;

            const sessionItems = items
              .map((s: Session) =>
                sessions.find(
                  (sess) =>
                    sess.title === s.title &&
                    (sess.last_active === s.last_active || sess.created_at === s.created_at)
                )
              )
              .filter((s): s is Session => s != null);

            return (
              <div key={label} style={{ marginBottom: '8px' }}>
                {/* Group label */}
                <p
                  style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.22)',
                    fontWeight: 600,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    margin: '10px 0 4px 8px',
                    lineHeight: 1,
                  }}
                >
                  {label}
                </p>

                {sessionItems.map((session: Session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={isActive}
                      onClick={() => handleSelectSession(session)}
                    />
                  );
                })}
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Doc filter chips */}
      {documents.length > 0 && <DocFilterChips documents={documents} />}
    </motion.aside>
  );
}

// ── New Chat Button ──────────────────────────────

function NewChatButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      id="new-chat-btn"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        width: '100%',
        height: '36px',
        borderRadius: '8px',
        background: hovered ? 'rgba(124,58,237,0.20)' : 'rgba(124,58,237,0.12)',
        border: `1px solid ${hovered ? 'rgba(124,58,237,0.40)' : 'rgba(124,58,237,0.25)'}`,
        color: 'rgba(255,255,255,0.80)',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'background 100ms ease, border-color 100ms ease',
        fontFamily: 'var(--font)',
      }}
    >
      <Plus size={14} />
      New Chat
    </button>
  );
}

// ── Session Item ─────────────────────────────────

function SessionItem({
  session,
  isActive,
  onClick,
}: {
  session: Session;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '6px 8px',
        borderRadius: isActive ? '0 6px 6px 0' : '6px',
        background: isActive
          ? 'rgba(255,255,255,0.04)'
          : hovered
          ? 'rgba(255,255,255,0.03)'
          : 'transparent',
        border: 'none',
        borderLeft: isActive ? '2px solid #7C3AED' : '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        marginBottom: '1px',
        transition: 'all 100ms ease',
        color: isActive
          ? 'rgba(255,255,255,0.88)'
          : 'rgba(255,255,255,0.45)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '12px',
            color: isActive ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.45)',
            fontWeight: isActive ? 500 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {truncate(session.title, 38)}
        </p>
      </div>
    </motion.button>
  );
}

// ── Doc filter chips ─────────────────────────────

function DocFilterChips({ documents }: { documents: Document[] }) {
  const sessions        = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const updateSession   = useSessionStore((s) => s.updateSession);

  const activeDoc_ids = useMemo(
    () => sessions.find((s) => s.id === activeSessionId)?.doc_ids ?? [],
    [sessions, activeSessionId]
  );

  const toggle = (docId: string) => {
    if (!activeSessionId) return;
    const current = activeDoc_ids;
    const next = current.includes(docId)
      ? current.filter((id) => id !== docId)
      : [...current, docId];
    updateSession(activeSessionId, { doc_ids: next });
  };

  const readyDocs = documents.filter((d) => d.status === 'ready');
  if (readyDocs.length === 0) return null;

  return (
    <div
      style={{
        padding: '10px 8px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <p
        style={{
          fontSize: '10px',
          color: 'rgba(255,255,255,0.22)',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          marginBottom: '6px',
          marginTop: 0,
        }}
      >
        Filter Docs
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {readyDocs.map((doc) => {
          const isActive = activeDoc_ids.includes(doc.id);
          return (
            <DocChip
              key={doc.id}
              doc={doc}
              isActive={isActive}
              onToggle={() => toggle(doc.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function DocChip({
  doc,
  isActive,
  onToggle,
}: {
  doc: Document;
  isActive: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      id={`doc-chip-${doc.id}`}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={doc.original_name ?? doc.name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '9999px',
        background: isActive ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isActive ? '#7C3AED' : 'rgba(255,255,255,0.08)'}`,
        color: isActive ? '#fff' : hovered ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.45)',
        fontSize: '11px',
        cursor: 'pointer',
        transition: 'all 100ms ease',
        fontFamily: 'var(--font)',
      }}
    >
      <FileText size={10} />
      {truncate(doc.original_name ?? doc.name, 14)}
    </button>
  );
}
