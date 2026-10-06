// src/components/chat/ModeSelector.tsx
// Feature 14 — Response style / mode selector
// Modes: Chat | Summary | Quiz | Flashcards | Notes | ELI5 | Interview
'use client';

import { useState } from 'react';
import {
  MessageSquare, FileText, HelpCircle, Layers,
  BookOpen, Smile, Mic, ChevronDown,
} from 'lucide-react';

export type ChatMode =
  | 'chat'
  | 'summary'
  | 'quiz'
  | 'flashcard'
  | 'notes'
  | 'eli5'
  | 'interview';

interface ModeConfig {
  label:       string;
  icon:        React.ReactNode;
  description: string;
  color:       string;
}

const MODES: Record<ChatMode, ModeConfig> = {
  chat:      { label: 'Chat',        icon: <MessageSquare size={13} />,  description: 'Natural Q&A',              color: '#A78BFA' },
  summary:   { label: 'Summary',     icon: <FileText      size={13} />,  description: 'Summarize document',       color: '#34D399' },
  quiz:      { label: 'Quiz',        icon: <HelpCircle    size={13} />,  description: 'Generate MCQ quiz',        color: '#F59E0B' },
  flashcard: { label: 'Flashcards',  icon: <Layers        size={13} />,  description: 'Create flashcards',        color: '#EC4899' },
  notes:     { label: 'Notes',       icon: <BookOpen      size={13} />,  description: 'Study notes',              color: '#60A5FA' },
  eli5:      { label: 'ELI5',        icon: <Smile         size={13} />,  description: 'Simple explanation',       color: '#FB923C' },
  interview: { label: 'Interview',   icon: <Mic           size={13} />,  description: 'Interview questions',      color: '#A3E635' },
};

interface ModeSelectorProps {
  selectedMode: ChatMode;
  onChange:     (mode: ChatMode) => void;
}

export function ModeSelector({ selectedMode, onChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = MODES[selectedMode];

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        id="mode-selector-btn"
        onClick={() => setOpen((v) => !v)}
        title="Select response mode"
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            '5px',
          padding:        '4px 10px 4px 8px',
          background:     'rgba(255,255,255,0.04)',
          border:         `1px solid rgba(255,255,255,0.09)`,
          borderRadius:   '8px',
          color:          current.color,
          fontSize:       '12px',
          fontWeight:     500,
          cursor:         'pointer',
          fontFamily:     'var(--font)',
          transition:     'all 150ms ease',
          whiteSpace:     'nowrap',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
        }}
      >
        {current.icon}
        {current.label}
        <ChevronDown size={11} style={{ opacity: 0.5, marginLeft: '1px' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position:     'absolute',
              bottom:       'calc(100% + 8px)',
              left:         0,
              zIndex:       50,
              background:   'rgba(18,18,18,0.97)',
              border:       '1px solid rgba(255,255,255,0.10)',
              borderRadius: '12px',
              padding:      '6px',
              minWidth:     '210px',
              backdropFilter: 'blur(20px)',
              boxShadow:    '0 -8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {(Object.entries(MODES) as [ChatMode, ModeConfig][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => { onChange(key); setOpen(false); }}
                style={{
                  width:        '100%',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '10px',
                  padding:      '8px 10px',
                  background:   selectedMode === key ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border:       'none',
                  borderRadius: '8px',
                  cursor:       'pointer',
                  color:        selectedMode === key ? cfg.color : 'rgba(255,255,255,0.6)',
                  fontSize:     '13px',
                  fontFamily:   'var(--font)',
                  textAlign:    'left',
                  transition:   'all 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (selectedMode !== key) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedMode !== key) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)';
                  }
                }}
              >
                <span style={{ color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
                <div>
                  <div style={{ fontWeight: 500, lineHeight: 1.2 }}>{cfg.label}</div>
                  <div style={{ fontSize: '11px', opacity: 0.5, lineHeight: 1.2 }}>{cfg.description}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
