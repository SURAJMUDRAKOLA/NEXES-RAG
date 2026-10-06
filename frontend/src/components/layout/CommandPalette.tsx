// src/components/layout/CommandPalette.tsx
// ⌘K / Ctrl+K command palette — glass morphism modal — Section 3.3
'use client';

import { useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare, FolderOpen, Map, Settings } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useSessionStore } from '@/store/useSessionStore';
import { MODAL_BACKDROP, MODAL_CONTENT } from '@/lib/variants';

const PAGES = [
  { label: 'Workspace',  href: '/workspace', icon: <FolderOpen  size={15} /> },
  { label: 'Chat',       href: '/chat',       icon: <MessageSquare size={15} /> },
  { label: 'Map',        href: '/map',        icon: <Map        size={15} /> },
  { label: 'Settings',   href: '/settings',   icon: <Settings   size={15} /> },
];

export function CommandPalette() {
  const open       = useUIStore((s) => s.commandPaletteOpen);
  const openPalette  = useUIStore((s) => s.openCommandPalette);
  const closePalette = useUIStore((s) => s.closeCommandPalette);
  const sessions   = useSessionStore((s) => s.sessions);
  const router     = useRouter();

  // Global keyboard shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open ? closePalette() : openPalette();
      }
      if (e.key === 'Escape' && open) closePalette();
    },
    [open, openPalette, closePalette]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const navigate = (href: string) => {
    router.push(href);
    closePalette();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cp-backdrop"
            variants={MODAL_BACKDROP}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={closePalette}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 999,
            }}
          />

          {/* Modal */}
          <motion.div
            key="cp-modal"
            variants={MODAL_CONTENT}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              position: 'fixed',
              top: '18%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '540px',
              maxWidth: 'calc(100vw - 32px)',
              zIndex: 1000,
              background: 'rgba(22, 22, 22, 0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border-hover)',
              borderRadius: 'var(--r-xl)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px var(--border)',
              overflow: 'hidden',
            }}
          >
            <Command
              style={{ background: 'transparent' }}
              shouldFilter
              loop
            >
              {/* Search input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <Search size={16} color="var(--text-3)" />
                <Command.Input
                  placeholder="Search documents, sessions, navigate…"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-1)',
                    fontSize: 'var(--size-sm)',
                    fontFamily: 'var(--font)',
                  }}
                  autoFocus
                />
                <kbd
                  style={{
                    padding: '2px 6px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    fontSize: '10px',
                    color: 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  ESC
                </kbd>
              </div>

              <Command.List
                style={{
                  maxHeight: '360px',
                  overflowY: 'auto',
                  padding: '8px',
                }}
              >
                <Command.Empty
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--text-3)',
                    fontSize: 'var(--size-sm)',
                  }}
                >
                  No results found.
                </Command.Empty>

                {/* Pages */}
                <Command.Group
                  heading="Navigation"
                  style={{ color: 'var(--text-3)', fontSize: 'var(--size-xs)', fontWeight: 600, padding: '4px 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                >
                  {PAGES.map((page) => (
                    <Command.Item
                      key={page.href}
                      value={page.label}
                      onSelect={() => navigate(page.href)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 10px',
                        borderRadius: 'var(--r-md)',
                        cursor: 'pointer',
                        color: 'var(--text-1)',
                        fontSize: 'var(--size-sm)',
                        marginBottom: '2px',
                      }}
                    >
                      <span style={{ color: 'var(--accent-light)' }}>{page.icon}</span>
                      {page.label}
                    </Command.Item>
                  ))}
                </Command.Group>

                {/* Sessions */}
                {sessions.length > 0 && (
                  <Command.Group
                    heading="Recent Sessions"
                    style={{ color: 'var(--text-3)', fontSize: 'var(--size-xs)', fontWeight: 600, padding: '4px 8px', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '8px' }}
                  >
                    {sessions.slice(0, 8).map((s) => (
                      <Command.Item
                        key={s.id}
                        value={s.title}
                        onSelect={() => navigate(`/chat?session=${s.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 10px',
                          borderRadius: 'var(--r-md)',
                          cursor: 'pointer',
                          color: 'var(--text-1)',
                          fontSize: 'var(--size-sm)',
                          marginBottom: '2px',
                        }}
                      >
                        <span style={{ color: 'var(--text-3)' }}>
                          <MessageSquare size={14} />
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.title}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              {/* Footer hint */}
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '8px 16px',
                  borderTop: '1px solid var(--border)',
                  color: 'var(--text-3)',
                  fontSize: '11px',
                }}
              >
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
