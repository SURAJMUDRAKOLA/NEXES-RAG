'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileText,
  MessageSquareText,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Zap,
} from 'lucide-react';
import { AuthCard } from './AuthCard';

const ParticleField = dynamic(() => import('@/components/three/ParticleField'), {
  ssr: false,
  loading: () => <div className="nexus-particle-fallback" />,
});

const featureCards = [
  {
    icon: UploadCloud,
    title: 'Drop the messy archive',
    text: 'PDFs, notes, reports, and internal docs become a single searchable workspace.',
  },
  {
    icon: Search,
    title: 'Ask across every source',
    text: 'NEXUS retrieves the right context before the answer is written.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust every response',
    text: 'Grounded citations and source previews keep answers auditable.',
  },
];

const proofPoints = [
  'Multimodal document memory',
  'Grounded answers with citations',
  'Realtime processing status',
  '3D knowledge map exploration',
];

export function NexusLandingPage() {
  return (
    <main className="nexus-public-page">
      <ParticleBackdrop />
      <NavBar />

      <section className="nexus-hero" aria-labelledby="nexus-hero-title">
        <div className="nexus-hero-copy">
          <motion.div
            className="nexus-eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <Sparkles size={16} />
            Universal RAG Bot for serious knowledge work
          </motion.div>

          <motion.h1
            id="nexus-hero-title"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            NEXUS
          </motion.h1>

          <motion.p
            className="nexus-hero-lede"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
          >
            A premium AI command center that turns documents into grounded answers,
            citation-backed insight, and a living knowledge graph.
          </motion.p>

          <motion.div
            className="nexus-hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <a href="#auth-start" className="nexus-hero-primary">
              Start with NEXUS
              <ArrowRight size={18} />
            </a>
            <a href="#knowledge-preview" className="nexus-hero-secondary">
              See the system
            </a>
          </motion.div>

          <motion.div
            className="nexus-proof-list"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.26 }}
          >
            {proofPoints.map((point) => (
              <span key={point}>
                <CheckCircle2 size={15} />
                {point}
              </span>
            ))}
          </motion.div>
        </div>

        <div className="nexus-hero-stack">
          <ProductPreview />
          <AuthCard />
        </div>
      </section>

      <section className="nexus-section nexus-feature-section" aria-label="NEXUS workflow">
        <div className="nexus-section-heading">
          <p>From upload to intelligence</p>
          <h2>Every document becomes part of one connected answer engine.</h2>
        </div>
        <div className="nexus-feature-grid">
          {featureCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.article
                className="nexus-feature-card"
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: index * 0.06 }}
              >
                <span>
                  <Icon size={22} />
                </span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="nexus-section nexus-command-section" id="knowledge-preview">
        <div className="nexus-command-copy">
          <p className="nexus-section-kicker">Grounded by design</p>
          <h2>Answers arrive with the evidence trail already attached.</h2>
          <p>
            NEXUS blends retrieval, semantic search, document processing, and source-aware
            responses into a workspace that feels fast, precise, and controlled.
          </p>
        </div>
        <KnowledgePanel />
      </section>

      <section className="nexus-section nexus-final-cta">
        <div>
          <p className="nexus-section-kicker">Ready when your archive is</p>
          <h2>Build a sharper knowledge base before the next question arrives.</h2>
        </div>
        <Link href="/login" className="nexus-final-link">
          Open signup
          <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}

export function NexusLoginPage() {
  return (
    <main className="nexus-login-page">
      <ParticleBackdrop />
      <Link href="/" className="nexus-login-brand" aria-label="Back to NEXUS home">
        NEXUS
      </Link>
      <section className="nexus-login-shell">
        <div className="nexus-login-copy">
          <p className="nexus-eyebrow">
            <Sparkles size={16} />
            Universal RAG Bot
          </p>
          <h1>Enter your private knowledge command center.</h1>
          <p>
            Sign in or create an account to upload documents, ask grounded questions,
            and explore your knowledge graph.
          </p>
          <ProductPreview compact />
        </div>
        <AuthCard compact />
      </section>
    </main>
  );
}

function ParticleBackdrop() {
  return (
    <div className="nexus-particle-backdrop" aria-hidden="true">
      <ParticleField />
    </div>
  );
}

function NavBar() {
  return (
    <header className="nexus-public-nav">
      <Link href="/" className="nexus-wordmark" aria-label="NEXUS home">
        <span>N</span>
        NEXUS
      </Link>
      <nav aria-label="Landing page navigation">
        <a href="#knowledge-preview">Platform</a>
        <a href="#auth-start">Sign in</a>
        <Link href="/login" className="nexus-nav-cta">
          Get started
        </Link>
      </nav>
    </header>
  );
}

function ProductPreview({ compact = false }: { compact?: boolean }) {
  return (
    <motion.div
      className={compact ? 'nexus-product-preview is-compact' : 'nexus-product-preview'}
      initial={{ opacity: 0, y: 24, rotateX: 4 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.55, delay: 0.18 }}
    >
      <div className="nexus-preview-topbar">
        <span />
        <span />
        <span />
        <p>live retrieval</p>
      </div>
      <div className="nexus-preview-grid">
        <div className="nexus-preview-main">
          <div className="nexus-query-line">
            <Search size={15} />
            Which source explains the Q4 retention drop?
          </div>
          <div className="nexus-answer-block">
            <MessageSquareText size={17} />
            <p>
              Retention softened after onboarding friction rose in enterprise workspaces.
              The strongest evidence appears in the renewal notes and support trend deck.
            </p>
          </div>
          <div className="nexus-source-row">
            <FileText size={16} />
            <div>
              <strong>renewal-analysis.pdf</strong>
              <span>94% match - page 18</span>
            </div>
          </div>
          <div className="nexus-source-row">
            <Database size={16} />
            <div>
              <strong>support-themes.csv</strong>
              <span>88% match - 2,140 rows</span>
            </div>
          </div>
        </div>
        <div className="nexus-preview-side">
          <div className="nexus-mini-metric">
            <Zap size={16} />
            <strong>1.8s</strong>
            <span>answer latency</span>
          </div>
          <div className="nexus-mini-metric">
            <BrainCircuit size={16} />
            <strong>128k</strong>
            <span>context window</span>
          </div>
          <div className="nexus-node-map" aria-hidden="true">
            <span className="node node-a" />
            <span className="node node-b" />
            <span className="node node-c" />
            <span className="node node-d" />
            <span className="node-line line-a" />
            <span className="node-line line-b" />
            <span className="node-line line-c" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function KnowledgePanel() {
  const items = [
    { icon: Network, label: 'Map', value: '342 linked concepts' },
    { icon: FileText, label: 'Sources', value: '1,284 indexed pages' },
    { icon: MessageSquareText, label: 'Answers', value: 'Citation-first responses' },
  ];

  return (
    <div className="nexus-knowledge-panel">
      <div className="nexus-knowledge-orbit" aria-hidden="true">
        <span className="orbit-center">
          <BrainCircuit size={34} />
        </span>
        <span className="orbit-dot dot-one" />
        <span className="orbit-dot dot-two" />
        <span className="orbit-dot dot-three" />
      </div>
      <div className="nexus-knowledge-list">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label}>
              <Icon size={19} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
