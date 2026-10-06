import { create } from 'zustand';
import { Session } from '@/types';

interface SessionStore {
  sessions:        Session[];
  activeSessionId: string | null;
  loading:         boolean;

  setSessions:      (s: Session[]) => void;
  addSession:       (s: Session)   => void;
  setActiveSession: (id: string | null) => void;
  updateSession:    (id: string, patch: Partial<Session>) => void;
  removeSession:    (id: string) => void;
  setLoading:       (v: boolean) => void;
  createSession:    (title?: string, docIds?: string[]) => Promise<Session>;
  fetchSessions:    () => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions:        [],
  activeSessionId: null,
  loading:         false,

  setSessions:      (sessions)       => set({ sessions }),
  addSession:       (session)        => set((s) => ({ sessions: [session, ...s.sessions] })),
  setActiveSession: (activeSessionId)=> set({ activeSessionId }),
  updateSession:    (id, patch)      => set((s) => ({
    sessions: s.sessions.map((sess) => sess.id === id ? { ...sess, ...patch } : sess),
  })),
  removeSession:    (id)             => set((s) => ({
    sessions: s.sessions.filter((sess) => sess.id !== id),
    activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
  })),
  setLoading:       (loading)        => set({ loading }),

  fetchSessions: async () => {
    set({ loading: true });
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { set({ loading: false }); return; }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        set({ sessions: json.sessions ?? [] });
      }
    } catch(e) { console.warn('fetchSessions:', e); }
    finally { set({ loading: false }); }
  },

  createSession: async (title = 'New Chat', docIds = []) => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? '';
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, doc_ids: docIds }),
    });
    const session: Session = await res.json();
    get().addSession(session);
    return session;
  },
}));
