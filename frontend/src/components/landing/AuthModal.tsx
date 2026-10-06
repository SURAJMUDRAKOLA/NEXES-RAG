'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Github, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { triggerFieldError, triggerFormError, recoil, successSettle } from '@/lib/animations';

// ── Validation ───────────────────────────────────────────────────────────────
const validateEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address';
const validatePassword = (v: string) =>
  v.length >= 8 ? '' : 'Password must be at least 8 characters';

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const passRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  // Esc to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // ── Field blur validation ─────────────────────────────────────────────────
  const handleEmailBlur = () => {
    if (!email) return;
    const err = validateEmail(email);
    if (err) {
      setFieldErrors((p) => ({ ...p, email: err }));
      triggerFieldError(emailRef.current, 'subtle');
    } else {
      setFieldErrors((p) => ({ ...p, email: undefined }));
      if (fieldErrors.email) successSettle(emailRef.current);
    }
  };

  const handlePasswordBlur = () => {
    if (!password) return;
    const err = validatePassword(password);
    if (err) {
      setFieldErrors((p) => ({ ...p, password: err }));
      triggerFieldError(passRef.current, 'subtle');
    } else {
      setFieldErrors((p) => ({ ...p, password: undefined }));
      if (fieldErrors.password) successSettle(passRef.current);
    }
  };

  // Clear field error on recovery
  useEffect(() => {
    if (fieldErrors.password && password.length >= 8) {
      setFieldErrors((p) => ({ ...p, password: undefined }));
      successSettle(passRef.current);
    }
  }, [password]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) { recoil(submitRef.current); return; }

    // Client validation
    const errs: typeof fieldErrors = {};
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr) { errs.email = emailErr; triggerFieldError(emailRef.current, 'normal'); }
    if (passErr) { errs.password = passErr; triggerFieldError(passRef.current, 'normal'); }
    if (tab === 'signup' && !name.trim()) { errs.name = 'Name is required'; triggerFieldError(nameRef.current, 'normal'); }
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true);
    setGlobalError('');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      if (tab === 'login') {
        const { error: err } = await sb.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await sb.auth.signUp({
          email, password,
          options: { data: { display_name: name } },
        });
        if (err) throw err;
      }
      router.push('/chat');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setGlobalError(msg);
      // Shake the whole card for invalid credentials
      triggerFormError(cardRef.current);
      // Flash and focus password if it's a credential error
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('wrong')) {
        triggerFieldError(passRef.current, 'subtle');
        setPassword('');
        setTimeout(() => (document.querySelector('#nexus-pass-input') as HTMLInputElement)?.focus(), 100);
      }
    } finally {
      setLoading(false);
    }
  }

  async function oAuth(provider: 'github' | 'google') {
    const { createClient } = await import('@/lib/supabase/client');
    const sb = createClient();
    await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <>
      {/* ── Backdrop ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.60)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 998,
        }}
      />

      {/* ── Centering shell (flex, NOT transform) ── */}
      <div
        style={{
          position: 'fixed', inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          pointerEvents: 'none',
          padding: '20px',
        }}
      >
        {/* ── Glass card ── */}
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.32, ease: [0.34, 1.4, 0.64, 1] }}
          style={{
            pointerEvents: 'all',
            width: 420,
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto',
            /* ── TRUE Apple iOS glass ── */
            background: 'rgba(255, 255, 255, 0.07)',
            backdropFilter: 'blur(60px) saturate(200%) brightness(1.15)',
            WebkitBackdropFilter: 'blur(60px) saturate(200%) brightness(1.15)',
            /* Top highlight edge — key to Apple glass look */
            borderTop: '1px solid rgba(255, 255, 255, 0.28)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.14)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 24,
            padding: '36px 32px 32px',
            /* Layered shadow for depth */
            boxShadow: [
              '0 0 0 0.5px rgba(255,255,255,0.10) inset',
              '0 2px 4px rgba(0,0,0,0.12) inset',
              '0 40px 80px rgba(0,0,0,0.50)',
              '0 0 120px rgba(109,40,217,0.30)',
            ].join(', '),
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
          >
            <X size={13} />
          </button>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.50), rgba(76,29,149,0.60))',
              border: '1px solid rgba(167,139,250,0.35)',
              marginBottom: 14,
              boxShadow: '0 0 32px rgba(124,58,237,0.35)',
            }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 20, color: '#ede9fe' }}>N</span>
            </div>
            <h2 style={{ margin: '0 0 5px', fontSize: 21, fontWeight: 600, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.01em' }}>
              {tab === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>
              {tab === 'login' ? 'Sign in to your Nexus workspace' : 'Start your AI knowledge journey'}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 22,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 4,
          }}>
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setGlobalError(''); setFieldErrors({}); }}
                style={{
                  flex: 1, height: 34, borderRadius: 9,
                  background: tab === t ? 'rgba(124,58,237,0.35)' : 'transparent',
                  border: tab === t ? '1px solid rgba(167,139,250,0.30)' : '1px solid transparent',
                  color: tab === t ? 'rgba(237,233,254,0.95)' : 'rgba(255,255,255,0.38)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 180ms ease',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: tab === t ? '0 2px 8px rgba(124,58,237,0.25)' : 'none',
                }}
              >
                {t === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* OAuth */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <OAuthButton label="GitHub" onClick={() => oAuth('github')} icon={<Github size={14} />} />
            <OAuthButton label="Google" onClick={() => oAuth('google')} icon={<GoogleIcon />} />
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>or email</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tab === 'signup' && (
              <GlassField
                ref={nameRef}
                id="nexus-name-input"
                label="Full name"
                type="text"
                value={name}
                onChange={setName}
                error={fieldErrors.name}
              />
            )}
            <GlassField
              ref={emailRef}
              id="nexus-email-input"
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              onBlur={handleEmailBlur}
              error={fieldErrors.email}
            />
            <GlassField
              ref={passRef}
              id="nexus-pass-input"
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              onBlur={handlePasswordBlur}
              error={fieldErrors.password}
              rightAddon={
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />

            {/* Global error banner */}
            <AnimatePresence>
              {globalError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 12px', borderRadius: 10,
                    background: 'rgba(239,68,68,0.10)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    fontSize: 12, color: '#fca5a5',
                  }}
                >
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  {globalError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              ref={submitRef}
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 46, marginTop: 4,
                borderRadius: 12,
                background: loading
                  ? 'rgba(124,58,237,0.40)'
                  : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                border: '1px solid rgba(167,139,250,0.20)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(124,58,237,0.40)',
                transition: 'all 200ms',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.55)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(124,58,237,0.40)'; }}
            >
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Spinner /> Signing in…
                  </span>
                : tab === 'login' ? 'Sign in →' : 'Create account →'}
            </button>
          </form>
        </motion.div>
      </div>
    </>
  );
}

// ── Glass input field ─────────────────────────────────────────────────────────
import { forwardRef } from 'react';

const GlassField = forwardRef<HTMLDivElement, {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  rightAddon?: React.ReactNode;
}>(({ id, label, type, value, onChange, onBlur, error, rightAddon }, ref) => {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;
  const isUp = focused || hasValue;

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ position: 'relative' }}>
        <label
          htmlFor={id}
          style={{
            position: 'absolute', left: 14,
            top: isUp ? 8 : '50%',
            transform: isUp ? 'translateY(0) scale(0.78)' : 'translateY(-50%)',
            transformOrigin: 'left center',
            fontSize: 13,
            color: error
              ? 'rgba(252,165,165,0.8)'
              : focused ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.28)',
            pointerEvents: 'none',
            transition: 'all 160ms cubic-bezier(0.4,0,0.2,1)',
            zIndex: 1, fontFamily: 'var(--font-sans)',
          }}
        >
          {label}
        </label>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          style={{
            width: '100%', height: 52,
            background: error
              ? 'rgba(239,68,68,0.05)'
              : focused ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${error
              ? 'rgba(239,68,68,0.55)'
              : focused ? 'rgba(124,58,237,0.55)' : 'rgba(255,255,255,0.09)'}`,
            borderRadius: 12,
            padding: isUp ? '18px 14px 6px' : '0 14px',
            paddingRight: rightAddon ? 40 : 14,
            fontSize: 14, color: 'rgba(255,255,255,0.90)',
            outline: 'none',
            boxShadow: focused ? '0 0 0 3px rgba(124,58,237,0.12)' : 'none',
            transition: 'all 160ms ease',
            fontFamily: 'var(--font-sans)',
            boxSizing: 'border-box',
          }}
        />
        {rightAddon && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}>
            {rightAddon}
          </div>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ margin: 0, fontSize: 11.5, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}
          >
            <AlertCircle size={11} style={{ flexShrink: 0 }} />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});
GlassField.displayName = 'GlassField';

// ── OAuth Button ─────────────────────────────────────────────────────────────
function OAuthButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, height: 42,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
        color: 'rgba(255,255,255,0.65)',
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'all 150ms', fontFamily: 'var(--font-sans)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
    >
      {icon} {label}
    </button>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Google Icon ──────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
