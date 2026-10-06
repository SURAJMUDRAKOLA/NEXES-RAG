'use client';
// src/app/(app)/settings/page.tsx
// Section 3.6 — Settings page redesign per nexus_uiux_complete_part2.html

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Moon, Sun, Monitor, Cloud, Cpu } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useFileStore } from '@/store/useFileStore';

const AppShell = dynamic(
  () => import('@/components/layout/AppShell').then((m) => ({ default: m.AppShell })),
  { ssr: false }
);

// ── Constants ────────────────────────────────────────────────────────────────
const LLM_MODELS = [
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-3-5-sonnet',
  'ollama/llama3.2',
  'ollama/mistral-nemo',
];
const EMBED_MODELS = [
  'openai/text-embedding-3-small',
  'ollama/nomic-embed-text',
];

type ActiveSection = 'general' | 'ai' | 'privacy' | 'appearance' | 'usage' | 'danger';
type Theme = 'dark' | 'light' | 'system';
type FontSize = 'small' | 'default' | 'large';

const FONT_SIZE_MAP: Record<FontSize, number> = { small: 13, default: 15, large: 17 };

const NAV_ITEMS: { key: ActiveSection; label: string }[] = [
  { key: 'general',    label: 'General' },
  { key: 'ai',         label: 'AI Model' },
  { key: 'privacy',    label: 'Privacy' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'usage',      label: 'Usage' },
  { key: 'danger',     label: 'Danger Zone' },
];

// ── CSS helpers ───────────────────────────────────────────────────────────────
const SETTINGS_CSS = `
@keyframes nexus-shimmer-btn {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
@keyframes nexus-save-glow {
  0%, 100% { box-shadow: 0 0 0px rgba(124,58,237,0); }
  50%       { box-shadow: 0 0 16px rgba(124,58,237,0.5); }
}
`;

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ label }: { label: string }) {
  return (
    <h2 style={{
      fontSize: 11,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.30)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 16,
    }}>
      {label}
    </h2>
  );
}

function SettingsCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#0f0f0f',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12,
      color: 'rgba(255,255,255,0.50)',
      fontWeight: 500,
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function StyledSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: '#0a0a0a',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 8,
        color: 'rgba(255,255,255,0.80)',
        fontSize: 13,
        fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
      }}
    >
      {options.map((o) => (
        <option key={o} value={o} style={{ background: '#0a0a0a' }}>{o}</option>
      ))}
    </select>
  );
}

// ── Confirmation dialog ───────────────────────────────────────────────────────
function ConfirmDeleteDialog({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [inputVal, setInputVal] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  const handleConfirm = () => {
    if (inputVal !== 'DELETE') {
      setShakeKey((k) => k + 1);
      return;
    }
    onConfirm();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          background: '#0f0f0f',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 16,
          padding: 28,
          width: 380,
          maxWidth: '90vw',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.90)', marginBottom: 8 }}>
          {title}
        </h3>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 20 }}>
          This action is irreversible. Type <strong style={{ color: '#EF4444' }}>DELETE</strong> to confirm.
        </p>

        <motion.div
          key={shakeKey}
          animate={shakeKey > 0 ? { x: [0, -8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Type DELETE"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#080808',
              border: `1px solid ${inputVal && inputVal !== 'DELETE' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: 8,
              color: 'rgba(255,255,255,0.80)',
              fontSize: 14,
              fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
              outline: 'none',
              marginBottom: 16,
            }}
          />
        </motion.div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.60)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={inputVal !== 'DELETE'}
            style={{
              padding: '8px 16px',
              background: inputVal === 'DELETE' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.05)',
              border: '1px solid rgba(239,68,68,0.40)',
              borderRadius: 8,
              color: inputVal === 'DELETE' ? '#EF4444' : 'rgba(239,68,68,0.40)',
              fontSize: 13,
              cursor: inputVal === 'DELETE' ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'all 150ms',
            }}
          >
            Confirm Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const fillColor = pct >= 95 ? '#EF4444' : pct >= 80 ? '#F59E0B' : undefined;
  return (
    <div style={{
      height: 4, borderRadius: 2,
      background: '#161616',
      marginTop: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        borderRadius: 2,
        background: fillColor ?? 'linear-gradient(90deg, #7C3AED, #A78BFA)',
        transition: 'width 600ms ease',
      }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const documents = useFileStore((s) => s.documents);

  // ── AI state ──
  const [aiProvider, setAiProvider] = useState<'online' | 'offline'>('online');
  const [llmModel, setLlmModel] = useState('openai/gpt-4o');
  const [embedModel, setEmbedModel] = useState('openai/text-embedding-3-small');
  const [originalEmbedModel, setOriginalEmbedModel] = useState('openai/text-embedding-3-small');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // ── Appearance ──
  const [theme, setTheme] = useState<Theme>('dark');
  const [fontSize, setFontSize] = useState<FontSize>('default');

  // ── Usage mock ──
  const [tokensUsed] = useState(42500);
  const [tokenBudget] = useState(100000);
  const [apiCost] = useState('$0.08');
  const totalChunks = documents.reduce((acc) => acc + 1, 0);

  // ── Save state ──
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Nav ──
  const [activeSection, setActiveSection] = useState<ActiveSection>('general');

  // ── Danger dialog ──
  const [dangerDialog, setDangerDialog] = useState<null | 'delete-docs' | 'reset-kb'>(null);

  // ── Load profile ──
  useEffect(() => {
    if (!user || profileLoaded) return;
    authApi.getProfile()
      .then((res) => {
        const p = res.data;
        if (p.ai_provider) setAiProvider(p.ai_provider);
        if (p.llm_model) setLlmModel(p.llm_model);
        if (p.embed_model) {
          setEmbedModel(p.embed_model);
          setOriginalEmbedModel(p.embed_model);
        }
        setPrivacyMode(p.ai_provider === 'offline');
        setProfileLoaded(true);
      })
      .catch(() => { /* Keep defaults */ });
  }, [user, profileLoaded]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await authApi.updateProfile({
        ai_provider: privacyMode ? 'offline' : aiProvider,
        llm_model: llmModel,
        embed_model: embedModel,
      });
      setSaveSuccess(true);
      setOriginalEmbedModel(embedModel);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Silent — toast can be wired in Phase 2
    } finally {
      setIsSaving(false);
    }
  }, [aiProvider, llmModel, embedModel, privacyMode]);

  const embedModelChanged = embedModel !== originalEmbedModel;

  // ── Section renderers ──────────────────────────────────────────────────────

  function renderGeneral() {
    return (
      <div>
        <SectionHeading label="General" />
        <SettingsCard>
          <FieldLabel>Display name</FieldLabel>
          <input
            readOnly
            value={user?.email ?? '—'}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#080808',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.60)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'default',
            }}
          />
          <p style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            Signed in via email. Profile editing coming soon.
          </p>
        </SettingsCard>
      </div>
    );
  }

  function renderAI() {
    return (
      <div>
        <SectionHeading label="AI Model" />

        {/* Provider cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {/* Cloud AI */}
          <button
            onClick={() => { setAiProvider('online'); setPrivacyMode(false); }}
            style={{
              padding: '16px 14px',
              borderRadius: 12,
              border: aiProvider === 'online'
                ? '1.5px solid rgba(124,58,237,0.70)'
                : '1px solid rgba(255,255,255,0.08)',
              background: aiProvider === 'online'
                ? 'rgba(124,58,237,0.06)'
                : '#0f0f0f',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 150ms',
            }}
          >
            <Cloud size={18} style={{ color: aiProvider === 'online' ? '#A78BFA' : 'rgba(255,255,255,0.30)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginBottom: 3 }}>Cloud AI</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>OpenAI / Anthropic</div>
            <div style={{
              marginTop: 10, fontSize: 10,
              color: aiProvider === 'online' ? '#A78BFA' : 'rgba(255,255,255,0.25)',
              fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
            }}>~$0.002/msg</div>
          </button>

          {/* Local AI */}
          <button
            onClick={() => { setAiProvider('offline'); setPrivacyMode(true); }}
            style={{
              padding: '16px 14px',
              borderRadius: 12,
              border: aiProvider === 'offline'
                ? '1.5px solid rgba(124,58,237,0.70)'
                : '1px solid rgba(255,255,255,0.08)',
              background: aiProvider === 'offline'
                ? 'rgba(124,58,237,0.06)'
                : '#0f0f0f',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 150ms',
            }}
          >
            <Cpu size={18} style={{ color: aiProvider === 'offline' ? '#A78BFA' : 'rgba(255,255,255,0.30)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginBottom: 3 }}>Local AI</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>Ollama</div>
            <div style={{
              marginTop: 10, fontSize: 10,
              color: aiProvider === 'offline' ? '#22C55E' : 'rgba(255,255,255,0.25)',
              fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
            }}>Free · Private</div>
          </button>
        </div>

        {/* LLM model */}
        <SettingsCard>
          <FieldLabel>LLM Model</FieldLabel>
          <StyledSelect
            value={llmModel}
            onChange={setLlmModel}
            options={LLM_MODELS}
          />
        </SettingsCard>

        {/* Embed model */}
        <SettingsCard>
          <FieldLabel>Embedding Model</FieldLabel>
          <StyledSelect
            value={embedModel}
            onChange={setEmbedModel}
            options={EMBED_MODELS}
          />
          <AnimatePresence>
            {embedModelChanged && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  overflow: 'hidden',
                  marginTop: 10,
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.30)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'rgba(245,158,11,0.90)',
                  lineHeight: 1.5,
                }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>⚠ Changing embedding model requires re-indexing all documents</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SettingsCard>
      </div>
    );
  }

  function renderPrivacy() {
    return (
      <div>
        <SectionHeading label="Privacy" />
        <SettingsCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)', marginBottom: 4 }}>
                Route all LLM calls to local Ollama
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                No data leaves your device
              </div>
            </div>
            <button
              role="switch"
              aria-checked={privacyMode}
              onClick={() => {
                const next = !privacyMode;
                setPrivacyMode(next);
                setAiProvider(next ? 'offline' : 'online');
              }}
              style={{
                width: 40, height: 22,
                borderRadius: 999,
                border: 'none',
                background: privacyMode ? '#7C3AED' : 'rgba(255,255,255,0.10)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 150ms',
                flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute',
                top: 3,
                left: privacyMode ? 21 : 3,
                width: 16, height: 16,
                borderRadius: '50%',
                background: 'white',
                transition: 'left 150ms',
              }} />
            </button>
          </div>
        </SettingsCard>
      </div>
    );
  }

  function renderAppearance() {
    return (
      <div>
        <SectionHeading label="Appearance" />

        {/* Theme cards */}
        <SettingsCard>
          <FieldLabel>Theme</FieldLabel>
          <div style={{ display: 'flex', gap: 10 }}>
            {([
              { key: 'dark' as Theme, icon: <Moon size={20} />, label: 'Dark' },
              { key: 'light' as Theme, icon: <Sun size={20} />, label: 'Light' },
              { key: 'system' as Theme, icon: <Monitor size={20} />, label: 'System' },
            ]).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                style={{
                  width: 80,
                  padding: '12px 8px',
                  borderRadius: 10,
                  border: theme === key
                    ? '1.5px solid rgba(124,58,237,0.70)'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: theme === key
                    ? 'rgba(124,58,237,0.06)'
                    : '#0a0a0a',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 150ms',
                }}
              >
                <span style={{ color: theme === key ? '#A78BFA' : 'rgba(255,255,255,0.35)' }}>
                  {icon}
                </span>
                <span style={{
                  fontSize: 11,
                  color: theme === key ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.35)',
                  fontWeight: theme === key ? 500 : 400,
                }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </SettingsCard>

        {/* Font size */}
        <SettingsCard>
          <FieldLabel>Font Size</FieldLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {(['small', 'default', 'large'] as FontSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: fontSize === size
                    ? '1px solid rgba(124,58,237,0.60)'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: fontSize === size
                    ? 'rgba(124,58,237,0.08)'
                    : '#0a0a0a',
                  color: fontSize === size
                    ? 'rgba(255,255,255,0.88)'
                    : 'rgba(255,255,255,0.40)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textTransform: 'capitalize',
                  transition: 'all 120ms',
                }}
              >
                {size}
              </button>
            ))}
          </div>
          {/* Live preview */}
          <div style={{
            padding: '10px 14px',
            background: '#080808',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            fontSize: FONT_SIZE_MAP[fontSize],
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.6,
            transition: 'font-size 150ms ease',
          }}>
            The quick brown fox jumps over the lazy dog
          </div>
        </SettingsCard>
      </div>
    );
  }

  function renderUsage() {
    const pct = Math.min(100, Math.round((tokensUsed / tokenBudget) * 100));
    return (
      <div>
        <SectionHeading label="Usage" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {/* Tokens */}
          <SettingsCard style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tokens this month
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>
              {tokensUsed.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>
              of {tokenBudget.toLocaleString()} · {pct}%
            </div>
            <ProgressBar value={tokensUsed} max={tokenBudget} />
          </SettingsCard>

          {/* API Cost */}
          <SettingsCard style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              API Cost
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>
              {apiCost}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>
              this month
            </div>
          </SettingsCard>

          {/* Documents */}
          <SettingsCard style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Documents indexed
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>
              {documents.length}
            </div>
          </SettingsCard>

          {/* Chunks */}
          <SettingsCard style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total chunks
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>
              {(totalChunks * 24).toLocaleString()}
            </div>
          </SettingsCard>
        </div>
      </div>
    );
  }

  function renderDanger() {
    return (
      <div>
        <SectionHeading label="Danger Zone" />
        <div style={{
          border: '1px solid rgba(239,68,68,0.30)',
          background: 'rgba(239,68,68,0.04)',
          borderRadius: 12,
          padding: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(239,68,68,0.80)', marginBottom: 16 }}>
            Danger Zone
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setDangerDialog('delete-docs')}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.30)',
                borderRadius: 8,
                color: 'rgba(239,68,68,0.80)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'background 120ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Delete all documents
            </button>
            <button
              onClick={() => setDangerDialog('reset-kb')}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.30)',
                borderRadius: 8,
                color: 'rgba(239,68,68,0.80)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'background 120ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Reset knowledge base
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sectionMap: Record<ActiveSection, () => React.ReactNode> = {
    general:    renderGeneral,
    ai:         renderAI,
    privacy:    renderPrivacy,
    appearance: renderAppearance,
    usage:      renderUsage,
    danger:     renderDanger,
  };

  return (
    <>
      <style>{SETTINGS_CSS}</style>
      <AppShell activeRoute="/settings">
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

          {/* ── Settings nav (left) ── */}
          <nav style={{
            width: 220,
            flexShrink: 0,
            background: '#0a0a0a',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            padding: '16px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.25)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '4px 10px',
              marginBottom: 8,
            }}>
              Settings
            </div>
            {NAV_ITEMS.map(({ key, label }) => {
              const isActive = activeSection === key;
              const isDanger = key === 'danger';
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: 'none',
                    borderLeft: isActive ? '2px solid #7C3AED' : '2px solid transparent',
                    background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                    color: isActive
                      ? 'rgba(255,255,255,0.88)'
                      : isDanger
                        ? 'rgba(239,68,68,0.70)'
                        : 'rgba(255,255,255,0.45)',
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'background 100ms, color 100ms',
                    marginLeft: isActive ? -2 : 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* ── Content area (right) ── */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '32px 40px 100px',
            position: 'relative',
          }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {sectionMap[activeSection]?.()}
              </motion.div>
            </AnimatePresence>

            {/* ── Sticky save button ── */}
            {activeSection !== 'danger' && activeSection !== 'usage' && activeSection !== 'appearance' && (
              <div style={{
                position: 'sticky',
                bottom: 0,
                paddingTop: 12,
                paddingBottom: 20,
                background: 'linear-gradient(to top, #080808 60%, transparent)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    border: 'none',
                    background: isSaving
                      ? 'linear-gradient(135deg, #7C3AED44, #5B21B644)'
                      : 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                    color: 'rgba(255,255,255,0.95)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isSaving ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'inherit',
                    animation: saveSuccess ? 'nexus-save-glow 0.4s ease' : undefined,
                    transition: 'opacity 150ms',
                    minWidth: 120,
                    justifyContent: 'center',
                  }}
                >
                  {saveSuccess ? (
                    <><Check size={14} /> Saved</>
                  ) : isSaving ? (
                    'Saving…'
                  ) : (
                    'Save Settings'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Danger zone dialog ── */}
        <AnimatePresence>
          {dangerDialog && (
            <ConfirmDeleteDialog
              title={dangerDialog === 'delete-docs' ? 'Delete all documents?' : 'Reset knowledge base?'}
              onConfirm={() => {
                // TODO: wire to documentsApi.deleteAll() / resetKB() in Phase 2
                setDangerDialog(null);
              }}
              onCancel={() => setDangerDialog(null)}
            />
          )}
        </AnimatePresence>
      </AppShell>
    </>
  );
}
