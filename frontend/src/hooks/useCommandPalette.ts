// src/hooks/useCommandPalette.ts
// ⌘K command palette hook — Section 3.1
'use client';
import { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';

export function useCommandPalette() {
  const { commandPaletteOpen, openCommandPalette, closeCommandPalette, toggleCommandPalette } = useUIStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        closeCommandPalette();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, toggleCommandPalette, closeCommandPalette]);

  return { commandPaletteOpen, openCommandPalette, closeCommandPalette };
}
