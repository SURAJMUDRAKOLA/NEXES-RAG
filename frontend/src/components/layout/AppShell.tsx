// src/components/layout/AppShell.tsx
// Left sidebar nav + main content slot — Section 3.3 Part 2 spec
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  MessageSquare,
  Map,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: <FolderOpen size={18} />, label: 'Workspace', href: '/workspace' },
  { icon: <MessageSquare size={18} />, label: 'Chat',      href: '/chat'      },
  { icon: <Map size={18} />,          label: 'Map',        href: '/map'       },
  { icon: <Settings size={18} />,     label: 'Settings',   href: '/settings'  },
];

interface AppShellProps {
  children: React.ReactNode;
  activeRoute?: string;
}

/* ─────────────────────────────────────────────
   Tooltip (simple pure-CSS hover tooltip)
───────────────────────────────────────────── */
function SideTooltip({ label, visible }: { label: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      style={{
        position: 'absolute',
        left: 'calc(100% + 10px)',
        top: '50%',
        transform: 'translateY(-50%)',
        background: '#1a1a1a',
        border: '0.5px solid #2a2a2a',
        borderRadius: '6px',
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'rgba(255,255,255,0.85)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   NavItem with Tooltip
───────────────────────────────────────────── */
function NavLink({
  item,
  isActive,
  expanded,
}: {
  item: NavItem;
  isActive: boolean;
  expanded: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={expanded ? undefined : item.label}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '2px 8px',
        padding: expanded ? '0 10px' : '0',
        height: '36px',
        borderRadius: expanded ? '8px' : '50%',
        width: expanded ? 'auto' : '36px',
        justifyContent: expanded ? 'flex-start' : 'center',
        textDecoration: 'none',
        background: isActive
          ? 'rgba(124,58,237,0.20)'
          : hovered
          ? 'rgba(255,255,255,0.06)'
          : 'transparent',
        color: isActive ? '#A78BFA' : 'rgba(255,255,255,0.50)',
        transition:
          'background 100ms ease, color 100ms ease, border-radius 200ms cubic-bezier(0.4,0,0.2,1), width 200ms cubic-bezier(0.4,0,0.2,1), padding 200ms cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {item.icon}
      </span>
      {expanded && (
        <span
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: isActive ? '#A78BFA' : 'rgba(255,255,255,0.75)',
          }}
        >
          {item.label}
        </span>
      )}
      {/* Tooltip only when collapsed */}
      {!expanded && hovered && (
        <SideTooltip label={item.label} visible={!expanded && hovered} />
      )}
    </Link>
  );
}

/* ─────────────────────────────────────────────
   Global shimmer keyframes injected once
───────────────────────────────────────────── */
const SHELL_STYLES = `
  @keyframes nexus-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @media (max-width: 768px) {
    .nexus-sidebar {
      display: none !important;
    }
    .nexus-main {
      padding-bottom: 56px !important;
    }
    .nexus-bottom-nav {
      display: flex !important;
    }
  }

  @media (min-width: 769px) {
    .nexus-bottom-nav {
      display: none !important;
    }
  }
`;

/* ─────────────────────────────────────────────
   AppShell
───────────────────────────────────────────── */
export function AppShell({ children, activeRoute: _activeRoute }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [userAvatarHover, setUserAvatarHover] = useState(false);
  const stylesInjected = useRef(false);

  const { user, signOut } = useAuth();

  // Derive initials from email
  const email = user?.email ?? '';
  const initials = email
    ? email.slice(0, 2).toUpperCase()
    : 'U';

  // Inject global CSS once
  useEffect(() => {
    if (stylesInjected.current) return;
    stylesInjected.current = true;
    const style = document.createElement('style');
    style.textContent = SHELL_STYLES;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: '#080808',
      }}
    >
      {/* ── Sidebar ─────────────────────────── */}
      <aside
        className="nexus-sidebar"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          width: expanded ? '220px' : '56px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
          borderRight: '1px solid #161616',
          transition: 'width 200ms cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          zIndex: 40,
          position: 'relative',
        }}
      >
        {/* Logo area — 52px tall */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            height: '52px',
            padding: expanded ? '0 10px 0 10px' : '0',
            justifyContent: expanded ? 'flex-start' : 'center',
            borderBottom: '1px solid #161616',
            textDecoration: 'none',
            flexShrink: 0,
            transition: 'padding 200ms cubic-bezier(0.4,0,0.2,1), justify-content 200ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Violet N icon in 36px circle */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(124,58,237,0.25)',
              color: '#A78BFA',
              flexShrink: 0,
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
              letterSpacing: '-0.02em',
            }}
          >
            N
          </span>
          {expanded && (
            <span
              style={{
                fontWeight: 700,
                fontSize: '14px',
                color: '#ffffff',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
              }}
            >
              NEXUS
            </span>
          )}
        </Link>

        {/* Nav Items */}
        <nav
          style={{
            flex: 1,
            padding: '8px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: expanded ? 'stretch' : 'center',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive}
                expanded={expanded}
              />
            );
          })}
        </nav>

        {/* Bottom: user avatar + sign-out */}
        <div
          style={{
            borderTop: '1px solid #161616',
            padding: '10px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {/* Avatar circle 32px */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(124,58,237,0.3)',
              border: '1px solid #7C3AED',
              color: '#A78BFA',
              fontSize: '11px',
              fontWeight: 700,
              flexShrink: 0,
              letterSpacing: '0.03em',
            }}
          >
            {initials}
          </span>

          {expanded && (
            <>
              <span
                style={{
                  flex: 1,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {email || 'User'}
              </span>
              <button
                aria-label="Sign out"
                onClick={handleSignOut}
                onMouseEnter={() => setUserAvatarHover(true)}
                onMouseLeave={() => setUserAvatarHover(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: userAvatarHover ? '#EF4444' : 'rgba(255,255,255,0.30)',
                  padding: '4px',
                  borderRadius: '6px',
                  transition: 'color 150ms ease',
                  flexShrink: 0,
                }}
              >
                <LogOut size={15} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────── */}
      <main
        className="nexus-main"
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          background: '#080808',
        }}
      >
        {children}
      </main>

      {/* ── Mobile bottom nav ───────────────── */}
      <nav
        className="nexus-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '56px',
          background: 'rgba(8,8,8,0.96)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 100,
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0 8px',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                textDecoration: 'none',
                color: isActive ? '#A78BFA' : 'rgba(255,255,255,0.35)',
                minWidth: '48px',
                padding: '4px 0',
              }}
            >
              {item.icon}
              {isActive && (
                <span
                  style={{
                    fontSize: '9px',
                    color: '#A78BFA',
                    lineHeight: 1,
                    fontWeight: 500,
                  }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
