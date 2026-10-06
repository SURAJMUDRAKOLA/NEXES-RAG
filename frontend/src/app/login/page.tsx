'use client';

import { type FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { getBrowserClient } from '@/lib/supabase/client';

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
type AuthTab = 'signin' | 'signup';

/* ─────────────────────────────────────────────────────────────────────────────
   SVG Icons (inline, no external deps)
───────────────────────────────────────────────────────────────────────────── */
function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Loading dots
───────────────────────────────────────────────────────────────────────────── */
function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#fff',
            display: 'inline-block',
            animation: `nexusDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Page Component
───────────────────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const supabase = getBrowserClient();

  const [tab, setTab] = useState<AuthTab>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoReady, setLogoReady] = useState(false);

  // Logo underline appears 200ms after mount
  useEffect(() => {
    const t = setTimeout(() => setLogoReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  function switchTab(next: AuthTab) {
    setTab(next);
    setError('');
    setSuccess('');
  }

  async function handleAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (tab === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.push('/workspace');
        return;
      }
      // signup
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: name ? { data: { full_name: name } } : undefined,
      });
      if (authError) throw authError;
      setSuccess('Check your email to confirm your account.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'github' | 'google') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/workspace` },
    });
  }

  const tabs: { id: AuthTab; label: string }[] = [
    { id: 'signin', label: 'Sign In' },
    { id: 'signup', label: 'Sign Up' },
  ];

  return (
    <>
      {/* ── Global @keyframes injected via <style> ── */}
      <style>{`
        @keyframes orb1 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(80px, -60px) scale(1.08); }
          66%  { transform: translate(-40px, 80px) scale(0.96); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes orb2 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(-90px, 60px) scale(1.06); }
          66%  { transform: translate(60px, -80px) scale(0.94); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes orb3 {
          0%   { transform: translate(-50%, -50%) scale(1); }
          50%  { transform: translate(-50%, -50%) scale(1.12); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes nexusDotPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes nexusLogoUnderline {
          from { width: 0; opacity: 0; }
          to   { width: 100%; opacity: 1; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::placeholder { color: rgba(255,255,255,0.30) !important; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff;
          -webkit-box-shadow: 0 0 0 100px rgba(255,255,255,0.05) inset;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* ── Root shell ── */}
      <div
        style={{
          position: 'relative',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: '#030303',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Animated orbs ── */}
        {/* Orb 1 — violet, top-left */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-20vw',
            left: '-20vw',
            width: '60vw',
            height: '60vw',
            borderRadius: '50%',
            background: '#4C1D95',
            filter: 'blur(80px)',
            opacity: 0.4,
            animation: 'orb1 18s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
            willChange: 'transform',
          }}
        />
        {/* Orb 2 — cyan, bottom-right */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '-20vw',
            right: '-20vw',
            width: '60vw',
            height: '60vw',
            borderRadius: '50%',
            background: '#0E7490',
            filter: 'blur(80px)',
            opacity: 0.35,
            animation: 'orb2 22s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
            willChange: 'transform',
          }}
        />
        {/* Orb 3 — indigo, center-back */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '60vw',
            height: '60vw',
            borderRadius: '50%',
            background: '#1E1B4B',
            filter: 'blur(100px)',
            opacity: 0.5,
            animation: 'orb3 26s ease-in-out infinite',
            willChange: 'transform',
          }}
        />

        {/* ── Nav bar ── */}
        <nav
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '22px 32px',
          }}
        >
          {/* Logo with framer layoutId */}
          <motion.div layoutId="nexus-logo" style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
            <span
              style={{
                fontFamily: '"Geist Mono", "JetBrains Mono", "Fira Code", monospace',
                fontSize: '20px',
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.08em',
                lineHeight: 1,
              }}
            >
              NEXUS
            </span>
            {logoReady && (
              <motion.span
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '100%', opacity: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{
                  display: 'block',
                  height: '2px',
                  background: '#7C3AED',
                  borderRadius: '1px',
                }}
              />
            )}
          </motion.div>

          {/* Sign up hint */}
          <button
            type="button"
            onClick={() => switchTab('signup')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.4)',
              transition: 'color 150ms',
              padding: '4px 0',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            New here?{' '}
            <span style={{ color: '#A78BFA', fontWeight: 500 }}>Sign up</span>
          </button>
        </nav>

        {/* ── Auth card (centered) ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            padding: '20px',
          }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '400px',
              maxWidth: '90vw',
              background: 'rgba(10,10,10,0.72)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '20px',
              padding: '40px 36px',
            }}
          >
            {/* ── Tab switcher ── */}
            <div
              style={{
                display: 'flex',
                gap: '24px',
                marginBottom: '28px',
                position: 'relative',
              }}
              role="tablist"
              aria-label="Authentication mode"
            >
              {tabs.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => switchTab(id)}
                  style={{
                    position: 'relative',
                    background: 'none',
                    border: 'none',
                    padding: '0 0 8px',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: tab === id ? 600 : 400,
                    color: tab === id ? '#fff' : 'rgba(255,255,255,0.4)',
                    transition: 'color 180ms, font-weight 180ms',
                  }}
                >
                  {label}
                  {tab === id && (
                    <motion.span
                      layoutId="auth-tab-indicator"
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #7C3AED, #A78BFA)',
                        borderRadius: '1px',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* ── OAuth buttons ── */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              {/* GitHub */}
              <OAuthButton onClick={() => handleOAuth('github')} icon={<GitHubIcon />} label="GitHub" />
              {/* Google */}
              <OAuthButton onClick={() => handleOAuth('google')} icon={<GoogleIcon />} label="Google" />
            </div>

            {/* ── Divider ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
              <span
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.25)',
                  whiteSpace: 'nowrap',
                }}
              >
                or continue with email
              </span>
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <AnimatePresence mode="wait">
                {tab === 'signup' && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <FormField
                      id="auth-name"
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={setName}
                      autoComplete="name"
                      required={tab === 'signup'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <FormField
                id="auth-email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                required
              />

              <FormField
                id="auth-password"
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={setPassword}
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                required
              />

              {/* ── Error / Success messages ── */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.p
                    key={`err-${error}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.36 }}
                    style={{
                      fontSize: '13px',
                      color: '#F87171',
                      background: 'rgba(248,113,113,0.08)',
                      border: '1px solid rgba(248,113,113,0.20)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                  >
                    {error}
                  </motion.p>
                )}
                {success && (
                  <motion.p
                    key={`ok-${success}`}
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.24 }}
                    style={{
                      fontSize: '13px',
                      color: '#34D399',
                      background: 'rgba(52,211,153,0.08)',
                      border: '1px solid rgba(52,211,153,0.20)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                  >
                    {success}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* ── CTA button ── */}
              <CTAButton loading={loading} tab={tab} />
            </form>
          </motion.div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────────────── */

interface FormFieldProps {
  id: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  autoComplete?: string;
  required?: boolean;
}

function FormField({ id, type, placeholder, value, onChange, autoComplete, required }: FormFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      required={required}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%',
        height: '44px',
        padding: '0 14px',
        background: 'rgba(255,255,255,0.05)',
        border: focused
          ? '1px solid rgba(124,58,237,0.7)'
          : '1px solid rgba(255,255,255,0.10)',
        borderRadius: '10px',
        color: '#fff',
        fontSize: '14px',
        outline: 'none',
        boxShadow: focused ? '0 0 0 3px rgba(124,58,237,0.15)' : 'none',
        transition: 'border 180ms, box-shadow 180ms',
      }}
    />
  );
}

interface OAuthButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function OAuthButton({ onClick, icon, label }: OAuthButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        background: hovered ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        color: 'rgba(255,255,255,0.80)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 150ms',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

interface CTAButtonProps {
  loading: boolean;
  tab: AuthTab;
}

function CTAButton({ loading, tab }: CTAButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <motion.button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      animate={{
        scale: pressed ? 0.98 : 1,
        y: hovered && !pressed ? -1 : 0,
      }}
      transition={{ duration: 0.12 }}
      style={{
        width: '100%',
        height: '44px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
        border: 'none',
        color: '#fff',
        fontSize: '14px',
        fontWeight: 500,
        letterSpacing: '0.01em',
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '4px',
        filter: hovered && !loading ? 'brightness(1.12)' : 'brightness(1)',
        boxShadow: hovered && !loading
          ? '0 8px 25px rgba(124,58,237,0.45)'
          : '0 4px 14px rgba(124,58,237,0.20)',
        transition: 'filter 180ms, box-shadow 180ms, opacity 180ms',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <LoadingDots />
      ) : tab === 'signin' ? (
        'Sign in →'
      ) : (
        'Create account →'
      )}
    </motion.button>
  );
}
