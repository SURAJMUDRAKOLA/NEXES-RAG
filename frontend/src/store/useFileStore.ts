// src/store/useFileStore.ts
// Zustand: uploaded files, processing status — Section 3.1
import { create } from 'zustand';
import { Document, UploadingFile, DocStatus } from '@/types';
import { documentsApi } from '@/lib/api';

interface FileStore {
  documents: Document[];
  uploadingFiles: UploadingFile[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDocuments: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  updateDocumentStatus: (id: string, status: DocStatus, progress: number) => void;
  removeUploadingFile: (id: string) => void;
  clearUploadingFiles: () => void;
}

export const useFileStore = create<FileStore>((set, get) => ({
  documents: [],
  uploadingFiles: [],
  isLoading: false,
  error: null,

  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await documentsApi.list();
      set({ documents: res.data.documents || [], isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  uploadFile: async (file: File) => {
    const tempId = `uploading-${Date.now()}-${Math.random()}`;
    const uploadingFile: UploadingFile = {
      id: tempId,
      file,
      status: 'queued',
      progress: 0,
    };

    set((state) => ({ uploadingFiles: [...state.uploadingFiles, uploadingFile] }));

    try {
      // Mark as parsing while we upload
      set((state) => ({
        uploadingFiles: state.uploadingFiles.map((f) =>
          f.id === tempId ? { ...f, status: 'parsing', progress: 10 } : f
        ),
      }));

      await documentsApi.upload(file, (pct) => {
        // Network upload progress maps 10% → 90%
        const mapped = 10 + Math.round(pct * 0.8);
        set((state) => ({
          uploadingFiles: state.uploadingFiles.map((f) =>
            f.id === tempId ? { ...f, progress: mapped } : f
          ),
        }));
      });

      // Remove temp entry; refresh docs list from server so we get the real ID
      set((state) => ({
        uploadingFiles: state.uploadingFiles.filter((f) => f.id !== tempId),
      }));

      await get().fetchDocuments();
    } catch (e: any) {
      set((state) => ({
        uploadingFiles: state.uploadingFiles.map((f) =>
          f.id === tempId ? { ...f, status: 'error', error: e.message } : f
        ),
      }));
    }
  },

  removeDocument: async (id: string) => {
    await documentsApi.delete(id);
    set((state) => ({ documents: state.documents.filter((d) => d.id !== id) }));
  },

  // Called by Supabase Realtime subscription (useRealtime hook)
  updateDocumentStatus: (id, status, progress) => {
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, status, progress } : d
      ),
    }));
  },

  removeUploadingFile: (id) => {
    set((state) => ({ uploadingFiles: state.uploadingFiles.filter((f) => f.id !== id) }));
  },

  clearUploadingFiles: () => set({ uploadingFiles: [] }),
}));
