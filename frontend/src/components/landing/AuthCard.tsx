'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Github,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/client';

type AuthTab = 'login' | 'signup';

interface AuthCardProps {
  initialTab?: AuthTab;
  compact?: boolean;
}

export function AuthCard({ initialTab = 'login', compact = false }: AuthCardProps) {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (tab === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        router.push('/workspace');
        return;
      }

      const { error: authError } = await supabase.auth.signUp({ email, password });
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

  function switchTab(nextTab: AuthTab) {
    setTab(nextTab);
    setError('');
    setSuccess('');
  }

  return (
    <motion.aside
      className={compact ? 'nexus-auth-card nexus-auth-card-compact' : 'nexus-auth-card'}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0, 0.5, 0.5, 1] }}
      id="auth-start"
    >
      <div className="nexus-auth-header">
        <span className="nexus-auth-kicker">
          <Sparkles size={14} />
          Private workspace
        </span>
        <h2>{tab === 'login' ? 'Welcome back' : 'Start building your brain'}</h2>
        <p>
          {tab === 'login'
            ? 'Enter the workspace where your documents, answers, and citations stay connected.'
            : 'Create your NEXUS account and turn scattered files into a searchable knowledge engine.'}
        </p>
      </div>

      <div className="nexus-auth-tabs" role="tablist" aria-label="Authentication mode">
        {(['login', 'signup'] as AuthTab[]).map((item) => (
          <button
            key={item}
            type="button"
            id={`auth-tab-${item}`}
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? 'is-active' : ''}
            onClick={() => switchTab(item)}
          >
            {item === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      <form className="nexus-auth-form" onSubmit={handleAuth}>
        <label className="nexus-field">
          <span>Email address</span>
          <Mail size={17} aria-hidden="true" />
          <input
            id="auth-email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="nexus-field">
          <span>Password</span>
          <KeyRound size={17} aria-hidden="true" />
          <input
            id="auth-password"
            type="password"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          />
        </label>

        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key={`error-${error}`}
              className="nexus-auth-message is-error"
              initial={{ opacity: 0, y: -6, x: 0 }}
              animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.36 }}
            >
              {error}
            </motion.p>
          )}
          {success && (
            <motion.p
              key={`success-${success}`}
              className="nexus-auth-message is-success"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.24 }}
            >
              {success}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          id="auth-submit"
          type="submit"
          className="nexus-primary-action"
          disabled={loading}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="nexus-spin" />
              Checking credentials
            </>
          ) : tab === 'login' ? (
            'Continue to workspace'
          ) : (
            'Create secure account'
          )}
        </motion.button>
      </form>

      <div className="nexus-auth-divider">
        <span />
        <p>or continue with</p>
        <span />
      </div>

      <div className="nexus-oauth-grid">
        <button type="button" onClick={() => handleOAuth('github')} id="auth-github">
          <Github size={18} />
          GitHub
        </button>
        <button type="button" onClick={() => handleOAuth('google')} id="auth-google">
          <span className="nexus-google-mark" aria-hidden="true">
            G
          </span>
          Google
        </button>
      </div>

      <p className="nexus-auth-footnote">
        <ShieldCheck size={14} />
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </motion.aside>
  );
}
