// src/hooks/useRealtime.ts
// Supabase Realtime subscription — watches document processing status
// Used by FileCard to show live queued→parsing→chunking→embedding→ready badges
'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RealtimeDocumentPayload {
  id: string;
  status: 'queued' | 'parsing' | 'chunking' | 'embedding' | 'ready' | 'error';
  progress: number;
  error_message: string | null;
}

/**
 * Subscribe to real-time document status updates from Supabase Realtime.
 * Calls onUpdate whenever a document row changes (status/progress fields).
 * Automatically cleans up subscription on unmount.
 */
export function useDocumentRealtime(
  userId: string | null,
  onUpdate: (doc: RealtimeDocumentPayload) => void
) {
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`documents:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const doc = payload.new as RealtimeDocumentPayload;
          onUpdate({
            id: doc.id,
            status: doc.status,
            progress: doc.progress,
            error_message: doc.error_message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

/**
 * Subscribe to new document inserts (e.g. when another device uploads).
 */
export function useDocumentInserts(
  userId: string | null,
  onInsert: (doc: any) => void
) {
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`documents-insert:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onInsert(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
