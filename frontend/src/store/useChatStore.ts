import { create } from 'zustand';
import { Message, SourceChunk } from '@/types';

interface ChatStore {
  messages:           Message[];
  isStreaming:        boolean;
  streamingContent:   string;
  currentSources:     SourceChunk[];
  relatedQuestions:   string[];
  keyPoints:          string[];
  lastIntent:         string;
  suggestedQuestions: string[];
  error:              string | null;

  setMessages:           (msgs: Message[]) => void;
  addMessage:            (msg: Message) => void;
  updateMessage:         (id: string, patch: Partial<Message>) => void;
  clearMessages:         () => void;
  setStreaming:          (v: boolean) => void;
  appendToken:           (id: string, token: string) => void;
  setSources:            (sources: SourceChunk[]) => void;
  setRelatedQuestions:   (qs: string[]) => void;
  setKeyPoints:          (kps: string[]) => void;
  setLastIntent:         (intent: string) => void;
  setSuggestedQuestions: (qs: string[]) => void;
  setError:              (e: string | null) => void;
  submitFeedback:        (messageId: string, feedback: 1 | -1) => Promise<void>;
  sendMessage:           (query: string, sessionId: string, docIds: string[], mode?: string) => Promise<void>;
  fetchMessages:         (sessionId: string) => Promise<void>;
  fetchSuggestedQuestions: (sessionId: string, docId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages:           [],
  isStreaming:        false,
  streamingContent:   '',
  currentSources:     [],
  relatedQuestions:   [],
  keyPoints:          [],
  lastIntent:         '',
  suggestedQuestions: [],
  error:              null,

  setMessages:  (messages) => set({ messages }),
  addMessage:   (msg)      => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage:(id, patch)=> set((s) => ({
    messages: s.messages.map((m) => m.id === id ? { ...m, ...patch } : m),
  })),
  clearMessages: () => set({
    messages:[], isStreaming:false, streamingContent:'',
    currentSources:[], relatedQuestions:[], keyPoints:[],
    lastIntent:'', suggestedQuestions:[], error:null,
  }),
  setStreaming:          (v)       => set({ isStreaming: v }),
  appendToken:           (id, tok) => set((s) => ({
    messages: s.messages.map((m) =>
      m.id === id ? { ...m, content: m.content + tok } : m
    ),
    streamingContent: s.streamingContent + tok,
  })),
  setSources:            (s)  => set({ currentSources: s }),
  setRelatedQuestions:   (qs) => set({ relatedQuestions: qs }),
  setKeyPoints:          (kps)=> set({ keyPoints: kps }),
  setLastIntent:         (i)  => set({ lastIntent: i }),
  setSuggestedQuestions: (qs) => set({ suggestedQuestions: qs }),
  setError:              (e)  => set({ error: e }),

  submitFeedback: async (messageId, feedback) => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? '';
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/${messageId}/feedback?feedback=${feedback}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      set((s) => ({
        messages: s.messages.map((m) => m.id === messageId ? { ...m, feedback } : m),
      }));
    } catch(e) { console.warn('submitFeedback:', e); }
  },

  sendMessage: async (query, sessionId, docIds, mode?) => {
    const now = new Date().toISOString();
    const userMsg: Message = {
      id:         `user-${Date.now()}`,
      session_id: sessionId,
      role:       'user',
      content:    query,
      created_at: now,
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id:         assistantId,
      session_id: sessionId,
      role:       'assistant',
      content:    '',
      isStreaming: true,
      created_at: now,
    };

    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isStreaming: true,
      streamingContent: '',
      error: null,
    }));

    try {
      const { streamChat } = await import('@/lib/stream');
      await streamChat(
        query,
        sessionId,
        docIds,
        (token) => {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m
            ),
            streamingContent: s.streamingContent + token,
          }));
        },
        (sources, relatedQuestions, keyPoints, intent) => {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, sources: sources }
                : m
            ),
            isStreaming:      false,
            streamingContent: '',
            currentSources:   sources ?? [],
            relatedQuestions: relatedQuestions ?? [],
            keyPoints:        keyPoints ?? [],
            lastIntent:       intent ?? '',
          }));
        },
        (err) => {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, content: m.content || `Error: ${err.message}` }
                : m
            ),
            isStreaming: false,
            error: err.message,
          }));
        },
        mode,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId
            ? { ...m, isStreaming: false, content: m.content || `Error: ${msg}` }
            : m
        ),
        isStreaming: false,
        error: msg,
      }));
    }
  },

  fetchMessages: async (sessionId) => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/sessions/${sessionId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        get().setMessages(json.messages ?? []);
      }
    } catch(e) { console.warn('fetchMessages:', e); }
  },

  fetchSuggestedQuestions: async (sessionId, docId) => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/documents/${docId}/suggested-questions?session_id=${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        get().setSuggestedQuestions(json.questions ?? []);
      }
    } catch(e) { console.warn('fetchSuggestedQuestions:', e); }
  },
}));
