'use client';
import { useState, useEffect, useRef } from 'react';

const MESSAGES = [
  'Knowledge is waiting.',
  'Every answer begins with a question.',
];

export default function IdleEasterEgg() {
  const [visible, setVisible] = useState(false);
  const [msg] = useState(
    () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  );
  const fired = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const reset = () => {
      clearTimeout(timerRef.current);
      if (fired.current) return;
      timerRef.current = setTimeout(() => {
        if (fired.current) return;
        fired.current = true;
        setVisible(true);
        setTimeout(() => setVisible(false), 7000);
      }, 30000);
    };

    reset();

    const evts: string[] = ['mousemove', 'keydown', 'touchstart', 'click'];
    evts.forEach((e) => window.addEventListener(e, reset));

    return () => {
      clearTimeout(timerRef.current);
      evts.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 180,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 12,
        color: 'rgba(255,255,255,0.22)',
        animation: 'idle-message-in 7s ease-in-out forwards',
        pointerEvents: 'none',
        zIndex: 15,
        whiteSpace: 'nowrap',
        letterSpacing: '0.04em',
      }}
    >
      {msg}
    </div>
  );
}
