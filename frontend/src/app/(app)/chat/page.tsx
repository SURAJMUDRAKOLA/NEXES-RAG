'use client';
// Clean ChatGPT-style chat page — sidebar + chat area, no extra routes

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MessageSquare, LogOut, Send, Paperclip,
  Mic, MicOff, X, FileText, ChevronLeft, Menu,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/useSessionStore';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, Session } from '@/types';

// ── date grouping ─────────────────────────────────────────────────────────────
function groupSessions(sessions: Session[]) {
  const now = new Date();
  const groups: Record<string, Session[]> = {
    Today: [], Yesterday: [], 'Previous 7 days': [], Older: [],
  };
  sessions.forEach((s) => {
    const d = new Date(s.last_active || s.created_at);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays < 1) groups['Today'].push(s);
    else if (diffDays < 2) groups['Yesterday'].push(s);
    else if (diffDays < 7) groups['Previous 7 days'].push(s);
    else groups['Older'].push(s);
  });
  return groups;
}

// ── Suggested prompts shown in empty state ────────────────────────────────────
const SUGGESTIONS = [
  'Summarize this document',
  'What are the key themes?',
  'Create flashcards from this',
  'Explain the main conclusions',
];

// ────────────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  useAuth(); // sync Supabase session → authStore

  const router = useRouter();
  const { sessions, activeSessionId, fetchSessions, createSession, setActiveSession } =
    useSessionStore();
  const { messages, isStreaming, sendMessage, addMessage, clearMessages, fetchMessages, setError } =
    useChatStore();
  const { user } = useAuthStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [creatingSession, setCreatingSession] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load sessions on mount
  useEffect(() => {
    fetchSessions().catch(() => {});
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId).catch(() => {});
    } else {
      clearMessages();
    }
  }, [activeSessionId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  // Auto-grow textarea
  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  // New Chat
  const handleNewChat = async () => {
    clearMessages();
    setActiveSession(null as unknown as string);
    setInputValue('');
    setAttachedFile(null);
    setUploadStatus('idle');
  };

  // Select session
  const handleSelectSession = (id: string) => {
    if (id === activeSessionId) return;
    setActiveSession(id);
    clearMessages();
  };

  // File attachment
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    setUploadStatus('uploading');

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      const { data: { session: authSession } } = await sb.auth.getSession();
      const token = authSession?.access_token ?? '';

      const formData = new FormData();
      formData.append('file', file);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/v1/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      setUploadStatus('done');
    } catch {
      setUploadStatus('done'); // still allow user to send
    }
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Send message
  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim();
    if (!text || isStreaming) return;
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let sid = activeSessionId;

    // Create session if needed
    if (!sid) {
      setCreatingSession(true);
      try {
        const newSession = await createSession(text.slice(0, 60));
        sid = newSession.id;
        setActiveSession(newSession.id);
      } catch (err) {
        setCreatingSession(false);
        console.warn('Session creation failed:', err);
        // Show a helpful error in the chat rather than a broken fetch
        addMessage({ id: `user-${Date.now()}`, session_id: '', role: 'user', content: text, created_at: new Date().toISOString() });
        addMessage({
          id: `err-${Date.now()}`, session_id: '', role: 'assistant',
          content: `⚠️ Backend not reachable. Make sure it's running:\n\`\`\`\ncd backend && python -m uvicorn app.main:app --port 8000\n\`\`\``,
          created_at: new Date().toISOString(),
        });
        return;
      } finally {
        setCreatingSession(false);
      }
    }

    if (!sid) return; // extra guard
    await sendMessage(text, sid, [], undefined);
  }, [inputValue, isStreaming, activeSessionId, createSession, sendMessage, setActiveSession]);

  // Keyboard handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Mic
  const toggleMic = useCallback(() => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return;
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.onresult = (ev: any) => {
      setInputValue(Array.from(ev.results as any[]).map((r: any) => r[0].transcript).join(''));
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }, [isRecording]);

  // Sign out
  const handleSignOut = async () => {
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut();
    router.push('/');
  };

  const grouped = groupSessions(sessions);
  const groupOrder = ['Today', 'Yesterday', 'Previous 7 days', 'Older'] as const;
  const isEmpty = messages.length === 0;
  const hasText = inputValue.trim().length > 0;
  const userInitials = (user?.email ?? 'U').slice(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      {/* ── Hidden file input ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.mp3,.mp4,.wav"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════ */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{
              width: 260,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              background: '#111111',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Top */}
            <div style={{ padding: '16px 12px 8px', flexShrink: 0 }}>
              {/* Logo row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, letterSpacing: '0.14em', color: '#a78bfa' }}>
                  NEXUS
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.30)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              {/* New Chat */}
              <button
                onClick={handleNewChat}
                style={{
                  width: '100%', height: 38,
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '0 12px',
                  background: 'rgba(124,58,237,0.10)',
                  border: '1px solid rgba(124,58,237,0.22)',
                  borderRadius: 10,
                  color: 'rgba(255,255,255,0.80)',
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.18)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.10)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.22)'; }}
              >
                <Plus size={15} />
                New Chat
              </button>
            </div>

            {/* Session list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
              {sessions.length === 0 ? (
                <div style={{ padding: '32px 12px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.20)', lineHeight: 1.6 }}>
                  No conversations yet.<br />Start a new chat!
                </div>
              ) : (
                groupOrder.map((group) => {
                  const items = grouped[group];
                  if (!items?.length) return null;
                  return (
                    <div key={group} style={{ marginBottom: 8 }}>
                      <p style={{
                        fontSize: 10, fontWeight: 600,
                        color: 'rgba(255,255,255,0.20)',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '8px 8px 4px', margin: 0,
                      }}>{group}</p>
                      {items.map((sess) => {
                        const isActive = sess.id === activeSessionId;
                        return (
                          <button
                            key={sess.id}
                            onClick={() => handleSelectSession(sess.id)}
                            title={sess.title}
                            style={{
                              width: '100%', textAlign: 'left',
                              padding: '8px 10px', borderRadius: 8,
                              background: isActive ? 'rgba(124,58,237,0.15)' : 'transparent',
                              border: 'none',
                              borderLeft: isActive ? '2px solid #7c3aed' : '2px solid transparent',
                              color: isActive ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.50)',
                              fontSize: 13, cursor: 'pointer',
                              display: 'block', overflow: 'hidden',
                              whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                              transition: 'all 120ms',
                              marginBottom: 2,
                              fontFamily: 'var(--font-sans)',
                            }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                          >
                            {sess.title || 'Untitled Chat'}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* User bottom */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(76,29,149,0.6))',
                border: '1px solid rgba(124,58,237,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#e9d5ff', flexShrink: 0,
              }}>
                {userInitials}
              </div>
              <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email ?? 'Guest'}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign out"
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════
          MAIN CHAT AREA
      ════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', background: '#0a0a0a' }}>

        {/* Top bar — only when sidebar closed */}
        {!sidebarOpen && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 52,
            display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(10,10,10,0.95)',
            backdropFilter: 'blur(8px)',
            zIndex: 10,
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Menu size={18} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
              NEXUS
            </span>
          </div>
        )}

        {/* Messages scroll area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingTop: sidebarOpen ? 32 : 68,
            paddingBottom: 160,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {isEmpty ? (
              /* ── Empty State ── */
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 28,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 18,
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(76,29,149,0.35))',
                    border: '1px solid rgba(124,58,237,0.30)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 18px',
                    boxShadow: '0 0 40px rgba(124,58,237,0.20)',
                  }}>
                    <Sparkles size={24} color="#a78bfa" />
                  </div>
                  <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                    What can I help you with?
                  </h1>
                  <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, maxWidth: 380 }}>
                    Upload a document with the paperclip button, then ask anything about it.
                  </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 520 }}>
                  {SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      style={{
                        padding: '9px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 9999,
                        color: 'rgba(255,255,255,0.55)',
                        fontSize: 13, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        transition: 'all 150ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.10)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.28)'; e.currentTarget.style.color = '#c4b5fd'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Message list ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                </AnimatePresence>

                {/* Typing indicator */}
                {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                  <div style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'flex-start' }}>
                    <NAvatar />
                    <div style={{ display: 'flex', gap: 5, paddingTop: 8 }}>
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(124,58,237,0.70)' }}
                          animate={{ y: [0, -7, 0], opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 0.75, delay: i * 0.13, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        {/* ── Floating Input Bar ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 24px 24px',
        }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            {/* Attached file chip */}
            {attachedFile && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', marginBottom: 8,
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: 8, fontSize: 12, color: '#c4b5fd',
              }}>
                <FileText size={13} />
                <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {attachedFile.name}
                </span>
                {uploadStatus === 'uploading' && (
                  <span style={{ animation: 'status-pulse 1.2s ease-in-out infinite', opacity: 0.7 }}>uploading…</span>
                )}
                {uploadStatus === 'done' && <span style={{ color: '#4ade80' }}>✓</span>}
                <button
                  onClick={() => { setAttachedFile(null); setUploadStatus('idle'); }}
                  style={{ background: 'transparent', border: 'none', color: '#a78bfa', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Input container */}
            <div
              style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                background: 'rgba(18,18,18,0.95)',
                border: `1px solid ${isFocused ? 'rgba(124,58,237,0.40)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: 16,
                padding: '12px 16px',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: isFocused
                  ? '0 0 0 3px rgba(124,58,237,0.12), 0 8px 40px rgba(0,0,0,0.5)'
                  : '0 4px 30px rgba(0,0,0,0.4)',
                transition: 'all 180ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                {/* Attach */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  style={{
                    background: 'transparent', border: 'none',
                    color: 'rgba(255,255,255,0.30)', cursor: 'pointer',
                    padding: '2px 0', display: 'flex', flexShrink: 0,
                    marginBottom: 2, transition: 'color 150ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#a78bfa')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.30)')}
                >
                  <Paperclip size={18} />
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  id="nexus-chat-input"
                  rows={1}
                  value={inputValue}
                  onChange={(e) => { setInputValue(e.target.value); autoGrow(); }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Message Nexus…"
                  disabled={isStreaming}
                  style={{
                    flex: 1, resize: 'none', background: 'transparent',
                    border: 'none', outline: 'none',
                    color: 'rgba(255,255,255,0.88)', fontSize: 14,
                    fontFamily: 'var(--font-sans)', lineHeight: '22px',
                    padding: 0, minHeight: 22, maxHeight: 200, overflowY: 'auto',
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginBottom: 2 }}>
                  {/* Mic */}
                  <button
                    onClick={toggleMic}
                    title={isRecording ? 'Stop' : 'Voice input'}
                    style={{
                      background: isRecording ? 'rgba(239,68,68,0.15)' : 'transparent',
                      border: 'none', borderRadius: 8,
                      color: isRecording ? '#f87171' : 'rgba(255,255,255,0.28)',
                      cursor: 'pointer', padding: '4px 6px', display: 'flex',
                      transition: 'all 150ms',
                    }}
                    onMouseEnter={(e) => { if (!isRecording) e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
                    onMouseLeave={(e) => { if (!isRecording) e.currentTarget.style.color = 'rgba(255,255,255,0.28)'; }}
                  >
                    {isRecording ? <MicOff size={17} /> : <Mic size={17} />}
                  </button>

                  {/* Send */}
                  <button
                    onClick={() => handleSend()}
                    disabled={!hasText || isStreaming}
                    style={{
                      width: 34, height: 34,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: hasText && !isStreaming
                        ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                        : 'rgba(255,255,255,0.06)',
                      border: 'none', borderRadius: 10,
                      color: hasText && !isStreaming ? '#fff' : 'rgba(255,255,255,0.20)',
                      cursor: hasText && !isStreaming ? 'pointer' : 'not-allowed',
                      transition: 'all 150ms',
                      flexShrink: 0,
                      boxShadow: hasText && !isStreaming ? '0 2px 12px rgba(124,58,237,0.40)' : 'none',
                    }}
                    onMouseEnter={(e) => { if (hasText && !isStreaming) e.currentTarget.style.transform = 'scale(1.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>

            <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.18)', margin: '8px 0 0' }}>
              Enter ↵ to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── N Avatar ──────────────────────────────────────────────────────────────────
function NAvatar() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(124,58,237,0.40), rgba(76,29,149,0.50))',
      border: '1px solid rgba(124,58,237,0.30)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#c4b5fd', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-sans)',
      marginTop: 2,
    }}>
      N
    </div>
  );
}

// ── Chat Message ──────────────────────────────────────────────────────────────
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        gap: 12,
        padding: '8px 0',
        alignItems: 'flex-start',
      }}
    >
      {!isUser && <NAvatar />}

      <div
        style={{
          maxWidth: isUser ? '72%' : '100%',
          padding: isUser ? '10px 16px' : '0',
          background: isUser
            ? 'rgba(124,58,237,0.14)'
            : 'transparent',
          border: isUser ? '1px solid rgba(124,58,237,0.22)' : 'none',
          borderRadius: isUser ? '18px 18px 4px 18px' : 0,
          fontSize: 14,
          lineHeight: 1.65,
          color: isUser ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.80)',
          flex: isUser ? 'none' : 1,
          minWidth: 0,
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <div className="prose-nexus">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p style={{ margin: '0 0 0.65em', lineHeight: 1.65, color: 'rgba(255,255,255,0.78)' }}>
                    {children}
                  </p>
                ),
                code: ({ node, inline, children, ...props }: any) =>
                  inline ? (
                    <code style={{
                      background: 'rgba(124,58,237,0.15)', padding: '1px 5px',
                      borderRadius: 4, fontSize: '0.87em', color: '#c4b5fd',
                      fontFamily: 'var(--font-mono)',
                    }}>{children}</code>
                  ) : (
                    <pre style={{
                      background: '#161616', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10, padding: '14px 16px', overflowX: 'auto',
                      margin: '0.6em 0', fontSize: '0.87em',
                    }}>
                      <code style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.75)' }}>{children}</code>
                    </pre>
                  ),
                ul: ({ children }) => <ul style={{ paddingLeft: '1.4em', margin: '0.3em 0 0.7em' }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: '1.4em', margin: '0.3em 0 0.7em' }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: '0.25em', color: 'rgba(255,255,255,0.75)' }}>{children}</li>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && <span className="streaming-cursor" />}
          </div>
        )}
      </div>
    </motion.div>
  );
}
