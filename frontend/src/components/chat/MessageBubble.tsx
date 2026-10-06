// src/components/chat/MessageBubble.tsx
// User & assistant message rendering — Section 3.4 Screen 3 redesign
'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Message, SourceChunk } from '@/types';
import { MESSAGE_ENTER } from '@/lib/variants';
import { useChatStore } from '@/store/useChatStore';
import { CitationBadge } from '@/components/chat/CitationBadge';
import { StreamingCursor } from '@/components/chat/StreamingCursor';

// Replace inline [N] citation markers with <CitationBadge>
function renderWithCitations(content: string, sources: SourceChunk[]) {
  const parts = content.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      const chunk = sources[idx - 1];
      if (chunk) {
        return <CitationBadge key={i} index={idx} chunk={chunk} />;
      }
    }
    return <span key={i}>{part}</span>;
  });
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const submitFeedback = useChatStore((s) => s.submitFeedback);
  const isUser        = message.role === 'user';
  const sources       = message.sources ?? [];

  const handleFeedback = useCallback(
    (f: 1 | -1) => {
      if (message.feedback != null) return;
      submitFeedback(message.id, f);
    },
    [message.id, message.feedback, submitFeedback]
  );

  if (isUser) {
    return (
      <motion.div
        variants={MESSAGE_ENTER}
        initial="initial"
        animate="animate"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          width: '100%',
          padding: '4px 0',
        }}
      >
        <div
          style={{
            alignSelf: 'flex-end',
            background: 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: '16px 16px 4px 16px',
            maxWidth: '70%',
            padding: '10px 14px',
            color: 'rgba(255,255,255,0.88)',
            fontSize: '14px',
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      variants={MESSAGE_ENTER}
      initial="initial"
      animate="animate"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        maxWidth: '90%',
        padding: '4px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: '10px',
          width: '100%',
        }}
      >
        {/* N-icon */}
        <div
          style={{
            flexShrink: 0,
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'rgba(124,58,237,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '2px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#A78BFA',
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            N
          </span>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: '14px',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.65,
          }}
        >
          <div className="prose-nexus">
            {sources.length > 0 ? (
              <div style={{ lineHeight: 1.7 }}>
                {renderWithCitations(message.content, sources)}
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code({ node, className, children, ...props }: any) {
                    const isInline = !className;
                    return isInline ? (
                      <code
                        style={{
                          background: 'var(--bg-active)',
                          padding: '1px 5px',
                          borderRadius: 'var(--r-sm)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.88em',
                          color: '#A78BFA',
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre({ children }: any) {
                    return (
                      <pre
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--r-md)',
                          padding: '12px 16px',
                          overflowX: 'auto',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--size-xs)',
                          lineHeight: 1.6,
                          margin: '8px 0',
                        }}
                      >
                        {children}
                      </pre>
                    );
                  },
                  p({ children }: any) {
                    return (
                      <p style={{ margin: '0 0 8px 0', color: 'rgba(255,255,255,0.75)' }}>
                        {children}
                      </p>
                    );
                  },
                  ul({ children }: any) {
                    return (
                      <ul style={{ paddingLeft: '20px', margin: '4px 0 8px', color: 'rgba(255,255,255,0.75)' }}>
                        {children}
                      </ul>
                    );
                  },
                  ol({ children }: any) {
                    return (
                      <ol style={{ paddingLeft: '20px', margin: '4px 0 8px', color: 'rgba(255,255,255,0.75)' }}>
                        {children}
                      </ol>
                    );
                  },
                  blockquote({ children }: any) {
                    return (
                      <blockquote
                        style={{
                          borderLeft: '3px solid rgba(124,58,237,0.6)',
                          paddingLeft: '12px',
                          color: 'rgba(255,255,255,0.55)',
                          margin: '8px 0',
                        }}
                      >
                        {children}
                      </blockquote>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}

            {/* Streaming cursor */}
            {message.isStreaming && <StreamingCursor />}
          </div>

          {/* Feedback buttons */}
          {!message.isStreaming && message.content && (
            <div
              style={{
                display: 'flex',
                gap: '6px',
                marginTop: '8px',
              }}
            >
              <button
                id={`feedback-up-${message.id}`}
                onClick={() => handleFeedback(1)}
                aria-label="Thumbs up"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: message.feedback === 1 ? 'var(--success-dim)' : 'transparent',
                  border: `1px solid ${message.feedback === 1 ? 'var(--success)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-sm)',
                  cursor: message.feedback != null ? 'default' : 'pointer',
                  color: message.feedback === 1 ? 'var(--success)' : 'rgba(255,255,255,0.30)',
                  padding: '3px 8px',
                  fontSize: '11px',
                  transition: 'all var(--dur-base)',
                }}
              >
                <ThumbsUp size={12} />
              </button>
              <button
                id={`feedback-down-${message.id}`}
                onClick={() => handleFeedback(-1)}
                aria-label="Thumbs down"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: message.feedback === -1 ? 'var(--error-dim)' : 'transparent',
                  border: `1px solid ${message.feedback === -1 ? 'var(--error)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-sm)',
                  cursor: message.feedback != null ? 'default' : 'pointer',
                  color: message.feedback === -1 ? 'var(--error)' : 'rgba(255,255,255,0.30)',
                  padding: '3px 8px',
                  fontSize: '11px',
                  transition: 'all var(--dur-base)',
                }}
              >
                <ThumbsDown size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
