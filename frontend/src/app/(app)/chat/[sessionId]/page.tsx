'use client';
// Redirect /chat/[sessionId] → /chat with session pre-loaded
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/useSessionStore';

export default function SessionRedirect() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { setActiveSession } = useSessionStore();

  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId);
    }
    router.replace('/chat');
  }, [sessionId]);

  return null;
}
