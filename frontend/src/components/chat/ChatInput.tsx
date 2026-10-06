// src/components/chat/ChatInput.tsx
// Upgraded: ModeSelector integrated, mode passed to sendMessage
'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  KeyboardEvent,
} from 'react';
import { Send, Mic, MicOff, Paperclip } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useSessionStore } from '@/store/useSessionStore';
import { ModeSelector, ChatMode } from '@/components/chat/ModeSelector';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition:       any;
    webkitSpeechRecognition: any;
  }
}

interface ChatInputProps {
  onSend?:       (text: string, mode?: string) => void;
  isStreaming?:  boolean;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [value,       setValue]       = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isFocused,   setIsFocused]   = useState(false);
  const [mode,        setMode]        = useState<ChatMode>('chat');

  const textareaRef    = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const isStreaming     = useChatStore((s) => s.isStreaming);
  const sendMessage     = useChatStore((s) => s.sendMessage);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const createSession   = useSessionStore((s) => s.createSession);
  const sessions        = useSessionStore((s) => s.sessions);

  // Auto-grow textarea
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  const handleSend = useCallback(async () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    setValue('');

    // Ensure session exists
    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await createSession(text.slice(0, 50));
      sessionId = session.id;
    }

    const docIds = sessions.find((s) => s.id === sessionId)?.doc_ids ?? [];
    const modeVal = mode === 'chat' ? undefined : mode;

    if (onSend) onSend(text, modeVal);
    else await sendMessage(text, sessionId, docIds, modeVal);
  }, [value, isStreaming, activeSessionId, sendMessage, createSession, sessions, onSend, mode]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Web Speech API mic
  const toggleMic = useCallback(() => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR          = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang             = 'en-US';
    recognition.interimResults   = true;
    recognition.maxAlternatives  = 1;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as any[])
        .map((r: any) => r[0].transcript)
        .join('');
      setValue(transcript);
    };
    recognition.onend  = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }, [isRecording]);

  const isEmpty     = value.trim().length === 0;
  const boxShadow   = isFocused
    ? '0 0 0 1px rgba(124,58,237,0.4), 0 8px 40px rgba(124,58,237,0.12)'
    : '0 0 0 1px rgba(124,58,237,0)';

  // Placeholder text changes with mode
  const placeholders: Record<ChatMode, string> = {
    chat:      'Ask anything about your documents...',
    summary:   'Which document should I summarize?',
    quiz:      'What topic should the quiz cover?',
    flashcard: 'Generate flashcards for...',
    notes:     'Generate study notes for...',
    eli5:      'What should I explain simply?',
    interview: 'Generate interview questions about...',
  };

  return (
    <div
      style={{
        position:        'absolute',
        bottom:          '24px',
        left:            '24px',
        right:           '24px',
        background:      'rgba(16,16,16,0.92)',
        border:          '1px solid rgba(255,255,255,0.10)',
        borderRadius:    '16px',
        padding:         '10px 16px 12px',
        backdropFilter:  'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow,
        transition:      'box-shadow 180ms ease',
        zIndex:          10,
      }}
    >
      {/* ── Top row: textarea ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
        {/* Paperclip */}
        <button
          aria-label="Attach file"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.30)', padding: '4px', flexShrink: 0,
            marginBottom: '2px',
          }}
        >
          <Paperclip size={18} />
        </button>

        {/* Auto-grow textarea */}
        <textarea
          ref={textareaRef}
          id="chat-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholders[mode]}
          rows={1}
          disabled={isStreaming}
          style={{
            flex:        1,
            background:  'transparent',
            border:      'none',
            outline:     'none',
            resize:      'none',
            color:       'rgba(255,255,255,0.85)',
            fontSize:    '14px',
            fontFamily:  'var(--font)',
            lineHeight:  '22px',
            padding:     '2px 0',
            overflowY:   'auto',
            maxHeight:   '200px',
          }}
        />

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginBottom: '2px' }}>
          {/* Mic */}
          <button
            onClick={toggleMic}
            aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: isRecording ? '#ef4444' : 'rgba(255,255,255,0.30)',
              padding: '4px', transition: 'color 150ms ease',
            }}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* Send */}
          <button
            id="chat-send-btn"
            onClick={handleSend}
            disabled={isEmpty || isStreaming}
            aria-label="Send message"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background:   isEmpty || isStreaming ? 'transparent' : 'rgba(124,58,237,0.20)',
              border:       'none',
              borderRadius: isEmpty || isStreaming ? '0' : '8px',
              padding:      isEmpty || isStreaming ? '4px' : '6px 8px',
              cursor:       isEmpty || isStreaming ? 'not-allowed' : 'pointer',
              color:        isEmpty || isStreaming ? 'rgba(255,255,255,0.18)' : '#A78BFA',
              transition:   'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isEmpty && !isStreaming)
                (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.30)';
            }}
            onMouseLeave={(e) => {
              if (!isEmpty && !isStreaming)
                (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.20)';
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* ── Bottom row: mode selector + hint ── */}
      <div
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         '8px',
          marginTop:   '8px',
          paddingTop:  '8px',
          borderTop:   '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <ModeSelector selectedMode={mode} onChange={setMode} />
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.18)', marginLeft: 'auto' }}>
          Enter ↵ to send · Shift+Enter for new line
        </span>
      </div>
    </div>
  );
}
