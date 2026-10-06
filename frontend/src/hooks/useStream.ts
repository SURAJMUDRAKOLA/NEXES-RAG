// src/hooks/useStream.ts
// Custom hook: SSE stream handler — Section 3.1
import { useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';

export function useStream() {
  const { sendMessage, isStreaming } = useChatStore();

  const send = useCallback(
    (query: string, sessionId: string, docIds: string[]) => {
      if (isStreaming) return; // Prevent concurrent streams
      return sendMessage(query, sessionId, docIds);
    },
    [sendMessage, isStreaming]
  );

  return { send, isStreaming };
}
