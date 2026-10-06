'use client';
// src/components/chat/ChatPane.tsx
// Upgraded: DocumentChips header, FollowUpChips after response, dynamic suggested questions

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/useChatStore';
import { useFileStore } from '@/store/useFileStore';
import { useSessionStore } from '@/store/useSessionStore';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { DocumentChips } from '@/components/chat/DocumentChips';
import { FollowUpChips } from '@/components/chat/FollowUpChips';
import { STAGGER_CHILDREN, STAGGER_ITEM } from '@/lib/variants';
import { Zap } from 'lucide-react';

interface ChatPaneProps {
  sessionId: string;
  docIds:    string[];
}

// Default suggested questions shown when no doc-specific ones are available
const DEFAULT_SUGGESTIONS = [
  'Summarize this document',
  'Generate flashcards',
  'Create a quiz',
  'Explain the key concepts',
  'Generate study notes',
  'Create interview questions',
  'Explain like I\'m 5',
  'What are the key takeaways?',
];

export function ChatPane({ sessionId, docIds }: ChatPaneProps) {
  const {
    messages,
    isStreaming,
    sendMessage,
    relatedQuestions,
    suggestedQuestions,
    fetchSuggestedQuestions,
  } = useChatStore();

  const { documents } = useFileStore();
  const sessions      = useSessionStore((s) => s.sessions);
  const session       = sessions.find((s) => s.id === sessionId);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active doc IDs — start from prop, allow toggling
  const [activeDocs, setActiveDocs] = useState<string[]>(docIds);

  // Load suggested questions for first active document
  useEffect(() => {
    if (activeDocs.length > 0 && messages.length === 0) {
      fetchSuggestedQuestions(sessionId, activeDocs[0]);
    }
  }, [activeDocs, sessionId, fetchSuggestedQuestions, messages.length]);

  // Auto-scroll to bottom on new messages / streaming
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  // Get documents for this session
  const sessionDocs = documents.filter(
    (d) => (session?.doc_ids ?? []).includes(d.id) || docIds.includes(d.id)
  );

  async function handleSend(query: string, mode?: string) {
    if (!query.trim() || isStreaming) return;
    await sendMessage(query, sessionId, activeDocs, mode);
  }

  function handleDocToggle(docId: string) {
    setActiveDocs((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  }

  const isEmpty       = messages.length === 0;
  const lastMessage   = messages[messages.length - 1];
  const showTyping    = isStreaming && lastMessage?.role === 'user';
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.isStreaming);

  // Which questions to show in empty state
  const displayedSuggestions = suggestedQuestions.length > 0 ? suggestedQuestions : DEFAULT_SUGGESTIONS;

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflow:      'hidden',
        position:      'relative',
      }}
    >
      {/* ── Document chips header ── */}
      {sessionDocs.length > 0 && (
        <DocumentChips
          documents={sessionDocs}
          selectedDocIds={activeDocs}
          onToggle={handleDocToggle}
        />
      )}

      {/* ── Message list ── */}
      <div
        ref={containerRef}
        style={{
          position:      'relative',
          flex:          1,
          overflowY:     'auto',
          padding:       '24px 24px 140px 24px',
          scrollBehavior: 'smooth',
        }}
      >
        {isEmpty ? (
          // Empty state — dynamic suggested questions
          <motion.div
            {...STAGGER_CHILDREN}
            initial="initial"
            animate="animate"
            style={{
              height:        '100%',
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              justifyContent: 'center',
              gap:           '28px',
              paddingBottom: '80px',
            }}
          >
            {/* Logo / heading */}
            <motion.div variants={STAGGER_ITEM} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width:          '60px',
                  height:         '60px',
                  borderRadius:   '18px',
                  background:     'rgba(124,58,237,0.15)',
                  border:         '1px solid rgba(124,58,237,0.35)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  margin:         '0 auto 18px',
                  boxShadow:      '0 0 32px rgba(124,58,237,0.15)',
                }}
              >
                <Zap size={26} color="#A78BFA" />
              </div>
              <h2
                style={{
                  fontSize:     '19px',
                  fontWeight:   600,
                  color:        'rgba(255,255,255,0.95)',
                  margin:       '0 0 8px',
                }}
              >
                {sessionDocs.length > 0
                  ? `Chat with ${sessionDocs.map((d) => d.name.replace(/\.[^/.]+$/, '')).join(', ')}`
                  : 'Ask anything about your documents'}
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                {sessionDocs.length > 0
                  ? 'Every answer is grounded in your uploaded sources'
                  : 'Upload a document first, then ask questions'}
              </p>
            </motion.div>

            {/* Suggested question chips */}
            <motion.div
              variants={STAGGER_ITEM}
              style={{
                display:        'flex',
                flexWrap:       'wrap',
                gap:            '9px',
                justifyContent: 'center',
                maxWidth:       '580px',
              }}
            >
              {displayedSuggestions.slice(0, 8).map((q) => (
                <SuggestedQuestion key={q} text={q} onSelect={handleSend} />
              ))}
            </motion.div>
          </motion.div>
        ) : (
          // Message list
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           '20px',
              maxWidth:      '760px',
              margin:        '0 auto',
              width:         '100%',
            }}
          >
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {showTyping && (
              <div style={{ maxWidth: '90%', width: '100%' }}>
                <TypingIndicator />
              </div>
            )}

            {/* Follow-up suggestion chips — shown after last assistant response */}
            {!isStreaming && lastAssistant && relatedQuestions.length > 0 && (
              <div style={{ maxWidth: '760px', paddingLeft: '4px' }}>
                <FollowUpChips
                  questions={relatedQuestions}
                  onSelect={(q) => handleSend(q)}
                  isVisible={true}
                />
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* ── Floating Chat Input ── */}
      <ChatInput onSend={handleSend} isStreaming={isStreaming} />
    </div>
  );
}

// ── Suggested Question Chip ──────────────────────────────────────────────────

function SuggestedQuestion({
  text,
  onSelect,
}: {
  text:     string;
  onSelect: (q: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(text)}
      style={{
        padding:      '8px 16px',
        background:   'rgba(255,255,255,0.03)',
        border:       '1px solid rgba(255,255,255,0.08)',
        borderRadius: '9999px',
        color:        'rgba(255,255,255,0.50)',
        fontSize:     '13.5px',
        cursor:       'pointer',
        transition:   'all 150ms ease',
        fontFamily:   'var(--font)',
        textAlign:    'left',
        lineHeight:   1.4,
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget;
        btn.style.background    = 'rgba(124,58,237,0.10)';
        btn.style.borderColor   = 'rgba(124,58,237,0.30)';
        btn.style.color         = '#C4B5FD';
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.background    = 'rgba(255,255,255,0.03)';
        btn.style.borderColor   = 'rgba(255,255,255,0.08)';
        btn.style.color         = 'rgba(255,255,255,0.50)';
      }}
    >
      {text}
    </button>
  );
}

export default ChatPane;
