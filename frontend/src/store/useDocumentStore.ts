import { create } from 'zustand';
import { Document } from '@/types';

interface DocumentStore {
  documents:       Document[];
  uploading:       string[];  // doc IDs being uploaded
  setDocuments:    (docs: Document[]) => void;
  addDocument:     (doc: Document) => void;
  updateDocument:  (id: string, patch: Partial<Document>) => void;
  removeDocument:  (id: string) => void;
  setUploading:    (ids: string[]) => void;
  fetchDocuments:  () => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  documents:  [],
  uploading:  [],
  setDocuments:   (docs)        => set({ documents: docs }),
  addDocument:    (doc)         => set((s) => ({ documents: [doc, ...s.documents] })),
  updateDocument: (id, patch)   => set((s) => ({
    documents: s.documents.map((d) => d.id === id ? { ...d, ...patch } : d),
  })),
  removeDocument: (id)          => set((s) => ({
    documents: s.documents.filter((d) => d.id !== id),
  })),
  setUploading:   (uploading)   => set({ uploading }),

  fetchDocuments: async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        set({ documents: json.documents ?? [] });
      }
    } catch(e) { console.warn('fetchDocuments:', e); }
  },
}));
