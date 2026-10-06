// src/components/insights/InsightsPanel.tsx
// Right panel: sources, key points, related questions, query info — Section 3.4
'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Lightbulb, HelpCircle, Info, Cpu, Clock, Hash } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useUIStore } from '@/store/useUIStore';
import { SourceCard } from '@/components/insights/SourceCard';
import { RelatedQuestions } from '@/components/insights/RelatedQuestions';
import { INSIGHTS_PANEL } from '@/lib/variants';

// Extract 3-5 bullet points from the last assistant message
function extractKeyPoints(content: string): string[] {
  if (!content) return [];

  // Try to find existing bullet lists first
  const bulletRegex = /^[-*•]\s+(.+)$/gm;
  const bullets: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = bulletRegex.exec(content)) !== null) {
    bullets.push(match[1].trim());
    if (bullets.length >= 5) break;
  }

  if (bullets.length >= 2) return bullets.slice(0, 5);

  // Fall back to splitting sentences
  const sentences = content
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 200);

  return sentences.slice(0, 4);
}

// Derive related questions based on key points
function deriveRelatedQuestions(content: string, sources: { doc_name?: string }[]): string[] {
  if (!content) return [];
  const docName = sources[0]?.doc_name ?? 'the document';
  const words = content.split(/\s+/).slice(0, 10).join(' ');
  return [
    `Can you elaborate on: "${words.slice(0, 40)}…"?`,
    `What are the key implications discussed in ${docName}?`,
    `Summarize the main conclusions from this analysis.`,
  ];
}

export function InsightsPanel() {
  const messages           = useChatStore((s) => s.messages);
  const currentSources     = useChatStore((s) => s.currentSources);
  const isStreaming        = useChatStore((s) => s.isStreaming);
  const storeRelatedQs     = useChatStore((s) => s.relatedQuestions);
  const storeKeyPoints     = useChatStore((s) => s.keyPoints);
  const insightsPanelOpen  = useUIStore((s) => s.insightsPanelOpen);
  const sendMessage        = useChatStore((s) => s.sendMessage);

  const lastAssistant = useMemo(
    () =>
      [...messages].reverse().find((m) => m.role === 'assistant' && !m.isStreaming),
    [messages]
  );

  const sources         = lastAssistant?.sources ?? currentSources;
  // Always derive locally as fallback (hooks must be unconditional)
  const derivedKeyPoints = useMemo(() => extractKeyPoints(lastAssistant?.content ?? ''), [lastAssistant]);
  const derivedRelatedQs = useMemo(() => deriveRelatedQuestions(lastAssistant?.content ?? '', sources), [lastAssistant, sources]);
  // Prefer stream-delivered values when available
  const keyPoints = storeKeyPoints.length > 0 ? storeKeyPoints : derivedKeyPoints;
  const relatedQs = storeRelatedQs.length > 0 ? storeRelatedQs : derivedRelatedQs;
  const shouldShow  = !isStreaming && lastAssistant != null;

  const handleRelatedSelect = async (question: string) => {
    if (!lastAssistant) return;
    // Reuse session / doc ids from last message
    const { session_id } = lastAssistant;
    const docIds = sources.map((s) => s.doc_id).filter(Boolean);
    await sendMessage(question, session_id, docIds);
  };

  return (
    <AnimatePresence>
      {insightsPanelOpen && shouldShow && (
        <motion.aside
          key="insights-panel"
          variants={INSIGHTS_PANEL}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{
            width: '280px',
            flexShrink: 0,
            height: '100%',
            overflow: 'auto',
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
          }}
        >
          {/* Sources */}
          {sources.length > 0 && (
            <section style={{ padding: '16px' }}>
              <SectionHeader icon={<BookOpen size={14} />} label="Sources" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {sources.map((chunk, i) => (
                  <SourceCard key={chunk.chunk_id ?? chunk.id} chunk={chunk} index={i + 1} />
                ))}
              </div>
            </section>
          )}

          {/* Key Points */}
          {keyPoints.length > 0 && (
            <section
              style={{
                padding: '16px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <SectionHeader icon={<Lightbulb size={14} />} label="Key Points" />
              <ul
                style={{
                  marginTop: '10px',
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {keyPoints.map((point, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start',
                      fontSize: 'var(--size-xs)',
                      color: 'var(--text-2)',
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        marginTop: '6px',
                        flexShrink: 0,
                      }}
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Related Questions */}
          {relatedQs.length > 0 && (
            <section
              style={{
                padding: '16px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <SectionHeader icon={<HelpCircle size={14} />} label="Related Questions" />
              <div style={{ marginTop: '10px' }}>
                <RelatedQuestions
                  questions={relatedQs}
                  onSelect={handleRelatedSelect}
                />
              </div>
            </section>
          )}

          {/* Query Info footer */}
          {lastAssistant && (
            <section
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border)',
                marginTop: 'auto',
                background: 'var(--bg-elevated)',
              }}
            >
              <SectionHeader icon={<Info size={14} />} label="Query Info" />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: '8px',
                }}
              >
                {lastAssistant.model_used && (
                  <InfoRow
                    icon={<Cpu size={11} />}
                    label="Model"
                    value={lastAssistant.model_used}
                  />
                )}
                {(lastAssistant.prompt_tokens || lastAssistant.completion_tokens) && (
                  <InfoRow
                    icon={<Hash size={11} />}
                    label="Tokens"
                    value={`${(lastAssistant.prompt_tokens ?? 0) + (lastAssistant.completion_tokens ?? 0)}`}
                  />
                )}
                {lastAssistant.latency_ms != null && (
                  <InfoRow
                    icon={<Clock size={11} />}
                    label="Latency"
                    value={`${lastAssistant.latency_ms} ms`}
                  />
                )}
              </div>
            </section>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ── Sub-components ───────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--text-3)',
        fontSize: 'var(--size-xs)',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {icon}
      {label}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: 'var(--text-3)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {icon}
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-2)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
