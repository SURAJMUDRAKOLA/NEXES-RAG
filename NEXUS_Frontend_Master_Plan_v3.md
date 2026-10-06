# NEXUS — Frontend Master Plan v3
### AI Knowledge Workspace · Complete Agent Prompt · Cosmic Landing + Chat-First Architecture

---

> **AGENT PRIME DIRECTIVE**
> Read this entire document before writing a single file.
> This supersedes all previous frontend plans. Follow this version only.
> Every decision here is final. Do not substitute libraries.
> Do not add pages or routes not listed. Do not skip phases.
> Do not connect backend until Phase 4.
> Each phase must compile with zero TypeScript errors before moving to the next.

---

## PRODUCT IDENTITY

NEXUS is not a chatbot. It is not a PDF reader.
It is a second brain. A premium AI knowledge workspace.

**Spiritual references:**
- Apple — restraint, precision, material feel
- Linear — dark interface, sharp typography, purposeful density
- Claude / ChatGPT — the chat-first interaction model
- Arc Browser — personality, delight, identity
- Dune / cinematic sci-fi — the landing page atmosphere

**The feeling a user should have:**
> "This feels like a product that costs money. I trust it with my important documents."

---

## ⭐ SIMPLIFIED ARCHITECTURE — READ CAREFULLY

This version removes the multi-page workspace concept entirely.
There is no separate "Library" page, no separate "Workspace" page, no
separate upload flow. The product is now three surfaces only:

```
1. Landing page        (route: /)
2. Auth modal           (overlay on landing — not a route)
3. Chat interface       (route: /chat and /chat/[sessionId])
   ↳ File upload happens INSIDE the chat, exactly like
     Claude.ai or ChatGPT — drag a file into the conversation
     or click the attach button in the input bar.
   ↳ There is no separate document library grid page.
   ↳ Uploaded documents appear as chips/cards inline in the
     conversation and are also listed in a compact way inside
     the left sidebar under the active session.
```

**Sidebar contains exactly these sections, top to bottom:**

```
┌─────────────────────┐
│ NEXUS (wordmark)     │  ← shared layoutId from landing
│ + New Chat            │  ← always visible, top of list
├─────────────────────┤
│ Chat History          │
│  Today                │
│   • Q3 report review  │
│  Yesterday             │
│   • Research notes    │
│  Previous 7 days       │
│   • Lecture summary   │
├─────────────────────┤  ← pinned to bottom, always visible
│ ⚙ Settings            │
│ ⎋ Logout              │
└─────────────────────┘
```

Knowledge map, analytics, and library pages are **removed from this
version** of the plan. They can be re-added later as a Phase 10 if
desired, but the core product is: **Landing → Auth → Chat.** Nothing else.

---

## TECH STACK — EXACT VERSIONS (unchanged from v2)

```bash
# Framework
next@15.3.0
react@19
typescript@5.8
tailwindcss@4.1

# UI
@shadcn/ui (use canary CLI for Tailwind v4 compatibility)
lucide-react@latest
next-themes@latest
sonner@latest
cmdk@latest
vaul@latest

# Animation — STRICT ROLES (never mix these roles)
animejs@4.0          # ALL micro-interactions, SVG, counters, reveals
framer-motion@11     # ONLY: AnimatePresence, layout, shared layoutId
lenis@latest         # smooth scroll — landing page only
split-type@latest    # word/char split for hero text reveals

# Forms & validation
react-hook-form@latest
zod@latest

# State
zustand@latest
@tanstack/react-query@latest

# Content
react-markdown@latest
rehype-highlight@latest
remark-gfm@latest
react-pdf@latest     # citation hover preview only
```

### ⚠️ Agent compatibility notes
- Use `npx shadcn@canary init` not `npx shadcn-ui@latest init`
- Anime.js v4 changed its API: `import { animate, createTimeline } from 'animejs'` — NOT `import anime from 'animejs'`
- Any component using `window`, `canvas`, or browser-only APIs must use `next/dynamic` with `ssr: false`

---

## FOLDER STRUCTURE (simplified for chat-first architecture)

```
src/
├── app/
│   ├── (auth)/
│   │   └── page.tsx                    # Landing + auth modal (route: /)
│   ├── (chat)/
│   │   ├── layout.tsx                  # Shell: sidebar + main chat area
│   │   ├── chat/
│   │   │   ├── page.tsx                # New chat (empty state)
│   │   │   └── [sessionId]/page.tsx    # Active session with messages
│   ├── globals.css
│   ├── layout.tsx                      # Root: providers
│   └── fonts.ts
│
├── components/
│   ├── landing/
│   │   ├── CosmicBackground.tsx        # The ring + bloom + starfield scene
│   │   ├── FloatingShards.tsx          # Crystal shard particles
│   │   ├── HeroWordmark.tsx            # NEXUS metallic gradient reveal
│   │   ├── HeroBadge.tsx               # "AI KNOWLEDGE WORKSPACE" pill
│   │   ├── FeatureCards.tsx            # Bottom 4-card row
│   │   ├── MouseParallax.tsx           # Parallax depth wrapper
│   │   ├── IdleEasterEgg.tsx           # 30s idle "Knowledge is waiting."
│   │   └── AuthModal.tsx               # Glass auth modal (Spotlight-style)
│   ├── chat/
│   │   ├── ChatPane.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── AssistantMessage.tsx
│   │   ├── UserMessage.tsx
│   │   ├── ThinkingIndicator.tsx
│   │   ├── StreamingCursor.tsx
│   │   ├── CitationBadge.tsx
│   │   ├── CitationPreview.tsx
│   │   ├── FollowUpChips.tsx
│   │   ├── EmptyChat.tsx               # Rotating suggestion prompts
│   │   └── InlineDocumentCard.tsx      # Uploaded file shown IN the chat
│   ├── input/
│   │   ├── FloatingInput.tsx
│   │   ├── InputBar.tsx
│   │   ├── AttachButton.tsx            # Opens file picker + drop zone
│   │   ├── VoiceButton.tsx
│   │   ├── DocumentChip.tsx            # Attached file pill in input
│   │   ├── SlashCommand.tsx
│   │   └── UploadDropZone.tsx          # Full-page drag overlay
│   ├── sidebar/
│   │   ├── AppSidebar.tsx              # The entire sidebar shell
│   │   ├── NewChatButton.tsx
│   │   ├── SessionList.tsx             # Grouped by date
│   │   ├── SessionItem.tsx
│   │   ├── SidebarFooter.tsx           # Settings + Logout, pinned bottom
│   │   └── SettingsModal.tsx           # Glass modal — all settings live here
│   ├── ui/                             # shadcn components
│   └── shared/
│       ├── GlassCard.tsx
│       ├── ProgressRing.tsx
│       ├── StatusBadge.tsx
│       ├── CommandPalette.tsx
│       ├── ErrorBoundary.tsx
│       ├── Skeleton.tsx
│       └── ThemeToggle.tsx
│
├── hooks/
│   ├── useStream.ts
│   ├── useRealtime.ts
│   ├── useCommandPalette.ts
│   ├── useVoiceInput.ts
│   ├── useDragDrop.ts
│   ├── useIdleTimer.ts                 # Powers the easter egg
│   └── useMediaQuery.ts
│
├── lib/
│   ├── api.ts
│   ├── stream.ts
│   ├── supabase.ts
│   ├── utils.ts
│   ├── animations.ts
│   └── variants.ts
│
├── store/
│   ├── useSessionStore.ts
│   ├── useDocumentStore.ts             # Docs are now session-scoped, not global library
│   ├── useChatStore.ts
│   ├── useUIStore.ts
│   └── useAuthStore.ts
│
├── types/
│   └── index.ts
│
└── styles/
    └── animations.css
```

---

## DESIGN TOKENS (unchanged core, extended for cosmic landing)

```css
@import "tailwindcss";

:root {
  /* ── Backgrounds ─────────────────────────────── */
  --bg-void:      #030303;
  --bg-base:      #080808;
  --bg-surface:   #0f0f0f;
  --bg-elevated:  #161616;
  --bg-hover:     #1c1c1c;
  --bg-active:    #222222;

  /* ── Glass surfaces ─────────────────────────── */
  --glass-01: rgba(255, 255, 255, 0.03);
  --glass-02: rgba(255, 255, 255, 0.06);
  --glass-03: rgba(255, 255, 255, 0.09);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-border-hover: rgba(255, 255, 255, 0.15);
  --glass-blur: 24px;
  --glass-blur-heavy: 48px;

  /* ── Text opacity scale ─────────────────────── */
  --text-1: rgba(255, 255, 255, 1.00);
  --text-2: rgba(255, 255, 255, 0.65);
  --text-3: rgba(255, 255, 255, 0.40);
  --text-4: rgba(255, 255, 255, 0.22);
  --text-5: rgba(255, 255, 255, 0.10);

  /* ── Borders ────────────────────────────────── */
  --border:         rgba(255, 255, 255, 0.07);
  --border-hover:   rgba(255, 255, 255, 0.14);
  --border-active:  rgba(255, 255, 255, 0.22);
  --border-focus:   rgba(124, 58, 237, 0.60);

  /* ── Accent: Electric Violet ────────────────── */
  --accent-700:  #4c1d95;
  --accent-600:  #5b21b6;
  --accent:      #7c3aed;
  --accent-400:  #8b5cf6;
  --accent-300:  #a78bfa;
  --accent-200:  #c4b5fd;
  --accent-glow: rgba(124, 58, 237, 0.35);
  --accent-dim:  rgba(124, 58, 237, 0.12);

  /* ── Cosmic landing palette (NEW) ────────────── */
  --cosmic-void:      #010103;
  --cosmic-ring:      rgba(168, 130, 255, 0.55);   /* the bright ring edge */
  --cosmic-ring-glow: rgba(124, 58, 237, 0.30);
  --cosmic-blue:      rgba(59, 130, 246, 0.35);     /* aurora blue streaks */
  --cosmic-violet:    rgba(139, 92, 246, 0.30);     /* aurora violet streaks */
  --cosmic-bloom:     rgba(147, 51, 234, 0.45);     /* floor bloom under NEXUS */
  --cosmic-metallic-1: #e9e4ff;                      /* NEXUS text gradient top */
  --cosmic-metallic-2: #a78bfa;                      /* NEXUS text gradient mid */
  --cosmic-metallic-3: #6d28d9;                      /* NEXUS text gradient bottom */
  --cosmic-shard:     rgba(196, 181, 253, 0.25);     /* crystal shard fill */
  --cosmic-star:      rgba(255, 255, 255, 0.8);      /* starfield points */

  /* ── Semantic ───────────────────────────────── */
  --success: #22c55e; --success-dim: rgba(34,197,94,0.12);
  --warning: #f59e0b; --warning-dim: rgba(245,158,11,0.12);
  --error:   #ef4444; --error-dim:   rgba(239,68,68,0.12);
  --info:    #3b82f6; --info-dim:    rgba(59,130,246,0.12);

  /* ── Typography ─────────────────────────────── */
  --font-sans: var(--font-geist-sans), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), monospace;

  /* ── Spacing ─────────────────────────────────── */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px;
  --sp-5:20px; --sp-6:24px; --sp-8:32px; --sp-10:40px;
  --sp-12:48px; --sp-16:64px;

  /* ── Radius ──────────────────────────────────── */
  --r-xs:4px; --r-sm:6px; --r-md:8px; --r-lg:12px;
  --r-xl:16px; --r-2xl:24px; --r-full:9999px;

  /* ── Animation timing ───────────────────────── */
  --dur-instant: 80ms;  --dur-fast: 150ms;  --dur-base: 250ms;
  --dur-slow: 400ms;    --dur-reveal: 1200ms;
  --dur-cosmic-slow: 90s;   /* aurora / ring drift */
  --dur-cosmic-bloom: 8s;   /* floor bloom breathing */
  --dur-cosmic-shard: 20s;  /* shard orbit drift */
  --ease-out:    cubic-bezier(0, 0.55, 0.45, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-expo:   cubic-bezier(0.19, 1, 0.22, 1);

  /* ── Sidebar ─────────────────────────────────── */
  --sidebar-collapsed: 60px;
  --sidebar-expanded: 240px;
}
```

---

## PHASE 1 — Design System & Architecture

Unchanged from v2. Deliverables:
1. Folder structure above (all files as empty exports)
2. `globals.css` with all tokens
3. `fonts.ts` — Geist Sans + Geist Mono
4. `lib/animations.ts` + `lib/variants.ts`
5. Root providers: ThemeProvider → QueryProvider → MotionConfig → SonnerProvider
6. Zustand stores with typed interfaces
7. `types/index.ts` — Document, Session, Message, Chunk, User, Source
8. Zero TypeScript errors (`tsc --noEmit`)

---

## PHASE 2 — Cosmic Landing Page ⭐ (fully respecced against reference image)

**Goal:** Recreate the mood and structure of the reference image using CSS,
SVG, and Canvas — not a static image asset. Every element below maps
directly to something visible in the reference.

### Layout — top to bottom, exact structure

```
┌──────────────────────────────────────────────┐
│ NEXUS                                          │  ← top-left, small, always visible
│                                                 │
│           ✦ AI KNOWLEDGE WORKSPACE             │  ← badge pill, centered
│                                                 │
│                  NEXUS                         │  ← huge metallic wordmark
│                                                 │
│      Where Documents Become Intelligence.      │  ← subtitle, one line
│                                                 │
│         Chat with any document.                │  ← micro-subtitle, one line only
│                                                 │
│            [ Enter Nexus  →]                    │  ← single CTA, breathing glow
│                                                 │
│  (floating crystal shards drift at edges)      │
│  (cosmic ring arcs behind everything)          │
│  (floor bloom + reflection at bottom)          │
│                                                 │
│  ┌────────┬──────────┬───────────┬──────────┐ │
│  │ Chat    │ Smart    │ Quizzes & │ Deep     │ │  ← 4 feature cards, floating
│  │ with    │ Summaries│ Flashcards│ Insights │ │
│  │ Docs    │          │           │          │ │
│  └────────┴──────────┴───────────┴──────────┘ │
└──────────────────────────────────────────────┘
```

**Critical simplification from the reference image:** remove the top nav
items (Features / How it Works / Use Cases / Pricing / About) and the
top-right "Enter Nexus" button entirely. Only the NEXUS wordmark sits
top-left. The center CTA is the only entry point. This was confirmed
as the right call — do not re-add marketing nav.

### 1. NEXUS Top-Left Wordmark (persistent nav mark)

```
Position: fixed top-left, 32px from edges
Font: Geist Sans, weight 600, 18px, letter-spacing 0.15em (tracked out, like the reference)
Color: var(--text-1)
This is the SAME element that will layoutId-morph into the sidebar
logo after authentication (Framer shared layout, see Phase 3).
No animation on load beyond a simple 400ms fade in, delay 100ms.
```

### 2. Cosmic Background — `CosmicBackground.tsx`

Built from four layered elements, back to front:

**Layer A — Starfield (Canvas, lowest layer)**
```
~150 static points, random positions, sizes 0.5–2px
Color: var(--cosmic-star) at random opacity 0.2–0.8
A handful (10%) twinkle: opacity oscillates slowly, randomized phase,
duration 3–6s per star, infinite loop
Rendered once on mount, never regenerated (avoid re-render cost)
```

**Layer B — The Ring (SVG, the defining visual element)**
```
A large circular/elliptical arc positioned behind and around NEXUS,
matching the reference: thick glowing violet-blue ring, brighter at
top, fading at the sides into aurora streaks.

Structure: SVG <circle> or <path> arc, radius ~55vw, centered
slightly above and behind the wordmark, stroke width 2-4px,
stroke: gradient from var(--cosmic-ring) to transparent at the ends.
Applied filter: blur(2px) for the glow softness, plus a second
duplicate path at blur(20px) and lower opacity behind it for the
outer glow halo (this double-layer technique is what gives the
reference image its glow depth).

Animation: the ring rotates on its own axis, imperceptibly slow.
transform: rotate(0deg) → rotate(360deg)
Duration: var(--dur-cosmic-slow) — 90 to 120 seconds, linear, infinite.
The viewer should never consciously notice motion, only feel that
the scene is alive.
```

**Layer C — Aurora Streaks (CSS mesh gradient blobs)**
```
Two to three large soft-edged gradient blobs positioned along the
ring's path — one blue-dominant (var(--cosmic-blue)), one violet-
dominant (var(--cosmic-violet)). These create the "wisps" of colour
that trail off to the left and right in the reference image.

Each blob: 60vw wide, blur(100px), mix-blend-mode: screen
Animation: independent drift paths using CSS custom properties,
each blob following a different elliptical path, 60-100s duration,
ease-in-out, infinite, alternating direction.
This matches "living background... clouds in space... 60-120 seconds"
from the animation brief.
```

**Layer D — Floor Bloom + Reflection (bottom third of viewport)**
```
A horizontal glowing arc at the very bottom of the viewport, like a
horizon line lit from within — matches the reference's ground-level
purple glow and faint reflection.

Structure: radial-gradient ellipse, var(--cosmic-bloom), positioned
at bottom center, blur(60px)
Breathing animation: opacity and scale both pulse
  0%   → opacity 0.5, scale 1
  50%  → opacity 0.8, scale 1.08
  100% → opacity 0.5, scale 1
Duration: var(--dur-cosmic-bloom) — 8 seconds, ease-in-out, infinite
This is the "heartbeat" described in the animation brief.

Below the bloom: a subtle horizontal reflection of the ring/wordmark
using CSS transform: scaleY(-1) + gradient mask fading to
transparent — mimics wet-floor reflection in the reference image.
```

### 3. Floating Crystal Shards — `FloatingShards.tsx`

```
4-6 small angular shard shapes (SVG polygons, irregular crystalline
forms) positioned at the edges of the viewport, matching the
reference image's scattered crystal fragments.

Fill: linear-gradient using var(--cosmic-shard), low opacity 0.15-0.3
Each shard: subtle inner glow via SVG filter (feGaussianBlur)

Animation — this is a "half-commit or remove" decision from the
earlier critique. FULL COMMIT: each shard orbits very slowly around
its own micro-path (a tiny 20-40px elliptical drift), completely
independent timing per shard (var(--dur-cosmic-shard), 18-24s range,
randomized per shard so none sync up).
Additionally each shard rotates slowly on its own axis, 40-60s per
rotation, opposite direction to its neighbour for visual variety.

If implementation time is constrained, these can be deferred to a
"v1.1 polish pass" — but if included, must be fully animated, never
static props.
```

### 4. Hero Badge — `HeroBadge.tsx`

```
Pill shape: "✦ AI KNOWLEDGE WORKSPACE"
Background: var(--glass-02)
Border: 1px solid var(--glass-border)
Border-radius: var(--r-full)
Padding: 8px 20px
Font: 11px, letter-spacing 0.12em, uppercase, var(--text-3)
Icon: small sparkle (Lucide "Sparkles"), var(--accent-300)

Entrance: opacity 0→1, translateY 8→0, 400ms, delay 200ms
(appears first, before the wordmark, exactly as in the reference
image where the badge sits above NEXUS)
```

### 5. NEXUS Hero Wordmark — Metallic Reveal

```
Font: Geist Sans, weight 800
Size: clamp(88px, 15vw, 200px) — larger than v2 spec to match the
      reference image's dominant scale
Letter-spacing: -0.03em (slightly tighter tracking at this size, but
      NOT as tight as pure Geist default — reference shows generous
      letter width)

Text fill: NOT flat white. Use a metallic vertical gradient:
  background: linear-gradient(180deg,
    var(--cosmic-metallic-1) 0%,
    var(--cosmic-metallic-2) 55%,
    var(--cosmic-metallic-3) 100%)
  background-clip: text; color: transparent;
This produces the brushed-metal / liquid-chrome look visible in the
reference image where NEXUS shifts from near-white at top to violet
at the base.

Additional glow: text-shadow layered softly behind (0 0 40px
var(--accent-glow)) to match the soft violet halo around the letters.

Animation sequence (SplitType + Anime.js):
  1. SplitType splits "NEXUS" into individual characters
  2. Each char: opacity 0→1, translateY 24→0, filter blur(10px)→blur(0),
     scale 0.94→1
  3. Stagger: 70ms between characters
  4. Duration per char: var(--dur-reveal) = 1200ms, easing: easeOutExpo
  5. Sequence per the brief: Blur → Opacity → Scale → Sharp
  6. Starts 300ms after badge finishes entrance
```

### 6. Subtitle + Micro-subtitle

```
Line 1 (subtitle): "Where Documents Become Intelligence."
  20px, weight 400, var(--text-2)
  The word "Intelligence." rendered in var(--accent-300) for emphasis
  (matches reference image's two-tone subtitle treatment)
  Reveal: SplitType by word, each word opacity 0→1 translateY 6→0,
  stagger 40ms, starts 500ms after wordmark finishes

Line 2 (micro-subtitle): "Chat with any document."
  ONE LINE ONLY — do not add a second descriptive sentence.
  14px, var(--text-3)
  Reveal: simple fade up, 300ms, 200ms after line 1
```

### 7. "Enter Nexus" Button — Breathing CTA

```
Style: pill button, larger than v2 spec (this is the singular hero CTA)
Padding: 14px 36px
Background: var(--glass-02)
Border: 1px solid var(--glass-border-hover)
Border-radius: var(--r-full)
Font: 15px weight 500, var(--text-1)
Icon: arrow-right (Lucide), 4px gap from text
Backdrop-filter: blur(16px)

Idle breathing animation (Anime.js, infinite):
  scale: 1 → 1.02 → 1
  Duration: 4000ms, easing: easeInOutSine, infinite
  (exact spec from the animation brief — "scale 1 → 1.02 → 1, 4 seconds")

Hover (interrupts breathing, Anime.js):
  Glass brightens: background → var(--glass-03)
  Border glows: border-color → var(--accent-300),
    box-shadow → 0 0 32px var(--accent-glow)
  Scale: → 1.05
  Arrow icon: translateX 0→4px
  Reflection sweep: a diagonal light gradient sweeps left to right
    across the button surface, 600ms, on hover only
  Duration: 200ms ease-out

Click — DO NOT NAVIGATE (critical):
  1. Button compresses: scale → 0.96, 100ms
  2. Background/ring scene subtly zooms: scale 1→1.04, 800ms ease-out
  3. NEXUS wordmark stays fixed in place (no movement yet)
  4. Everything behind blurs: backdrop-filter blur 0→12px, 400ms
  5. AuthModal grows from center: scale 0.9→1, opacity 0→1,
     blur 20px→0, spring easing — "macOS Spotlight" entrance
  (Full detail in Auth Modal section below)
```

### 8. Feature Cards Row — Bottom of Viewport

```
Four cards in a single glass-bordered row container (matches the
reference image's connected pill-card row):
  "Chat with Documents" / "Smart Summaries" /
  "Quizzes & Flashcards" / "Deep Insights"

Container: full width (max 1100px), background var(--glass-01),
  border 1px solid var(--border), border-radius var(--r-2xl),
  divided internally by 1px vertical separators

Each card: icon (24px, accent-tinted background chip) + title (14px
  weight 500, var(--text-1)) + description (12px, var(--text-3))

Entrance: fade up, stagger 100ms per card, starts 800ms after CTA
  button appears

Idle floating (subtle, continuous):
  Each card translateY oscillates ±3px on its own sine wave,
  duration 6-9s per card (varied so none sync), infinite,
  easeInOutSine
  This is barely perceptible — "richly felt, not noticed" per brief
```

### 9. Mouse Parallax Depth — `MouseParallax.tsx`

```
Three depth layers respond to mouse position at different magnitudes
(matches brief: "Hero 2px / Aurora 10px / Glow 20px"):

  Hero wordmark + badge + subtitle: translate up to 2px max
  Ring + aurora streaks:            translate up to 10px max
  Floor bloom + outer glow:          translate up to 20px max

Implementation: track mouse position as percentage of viewport,
apply via CSS custom properties updated on mousemove (throttled to
~60fps with requestAnimationFrame), each layer reads a different
multiplier off the same base values.

Additionally (from the "ring reacts to mouse" brainstorm): the ring
SVG applies a very subtle 3D perspective tilt, max 2-3 degrees,
via transform: perspective(1000px) rotateX() rotateY(), driven by
the same mouse tracking.
```

### 10. Idle Easter Egg — `IdleEasterEgg.tsx`

```
Trigger: useIdleTimer hook detects 30-60s of no mouse/keyboard activity
  on the landing page (before auth modal is opened).

On trigger:
  1. Aurora streaks intensify: opacity +15%, over 2s
  2. Floor bloom brightens and pulses once, larger amplitude
  3. A handful of starfield points drift slowly toward center
     (their translate animates toward the NEXUS wordmark's position,
     very slowly, 8-10s duration)
  4. NEXUS wordmark emits one gentle pulse: text-shadow glow
     intensifies then settles, 2s
  5. A line fades in beneath the micro-subtitle:
     "Knowledge is waiting." OR "Every answer begins with a question."
     (randomly pick one), 12px, var(--text-4), fade in 600ms,
     holds for 6s, fades out 600ms

Resets on any user interaction. Fires only once per session (do not
repeat every 30s indefinitely — that becomes annoying, not delightful).
```

### 11. Auth Modal — Glass Spotlight Card

```
Trigger: "Enter Nexus" click (see button click sequence above)

Entrance (Anime.js + spring physics):
  scale: 0.9 → 1
  opacity: 0 → 1
  filter: blur(20px) → blur(0)
  translateY: 16 → 0
  Duration: 450ms, custom spring (overshoot slightly then settle —
  "feels physical" per brief)

Dimensions: 400px wide, auto height, fixed center viewport, z-index 100

Glass spec:
  background: rgba(10,10,10,0.75)
  backdrop-filter: blur(48px) saturate(160%)
  border: 1px solid rgba(255,255,255,0.12)
  border-radius: 20px
  padding: 40px 36px
  box-shadow:
    0 0 0 0.5px rgba(255,255,255,0.06) inset,
    0 32px 64px rgba(0,0,0,0.6),
    0 0 80px var(--cosmic-ring-glow)

Reflection detail: a soft diagonal highlight band across the glass
  surface, animating position very slowly left-to-right, full cycle
  15s, opacity 0.03-0.06 (matches brief: "reflection slowly moves
  left to right every 15 sec")

Contents (top to bottom):
  1. NEXUS wordmark, small, 18px Geist Mono weight 700, centered
     → this is layoutId="nexus-wordmark", shared with the top-left
     landing mark AND the future sidebar logo
  2. "Welcome back" — 20px weight 500
  3. "Sign in to your knowledge workspace" — 13px var(--text-3)
  4. OAuth row: GitHub + Google, equal width glass buttons
  5. Divider: "or continue with email"
  6. Email input — glass style, floating label
  7. Password input — glass style, floating label, show/hide toggle
  8. "Continue" button — full width, accent gradient
  9. Tab toggle Login/Sign Up, Framer layoutId sliding indicator

Input focus (matches brief "border glows, reflection changes, cursor
  fades in"):
  border-color → var(--border-focus), 180ms
  box-shadow → 0 0 0 3px rgba(124,58,237,0.15)
  A very subtle inner reflection gradient shifts position slightly

Dismiss: Escape key or click outside
  Reverse the entrance animation, 250ms, background scene un-zooms
  and un-blurs back to idle state
```

---

## PHASE 3 — Chat-First Workspace Shell (replaces old multi-page workspace)

**Goal:** After successful login, the entire cosmic landing scene
transforms into the clean chat interface. One continuous world, no
page navigation, no route change flash.

### The Login → Workspace Transition

```
Sequence (matches the animation brief's login timeline exactly):
  1. Glass auth card fades out: opacity 1→0, scale 1→0.96, 250ms
  2. Cosmic background zooms further and darkens: scale →1.15,
     brightness →0.4, 600ms
  3. NEXUS wordmark (still the same layoutId element) shrinks and
     moves from center-stage position to top-left sidebar position
     — Framer Motion shared layout handles the path automatically,
     spring transition, ~700ms
  4. Cosmic scene fades to the flat dark workspace background
     (var(--bg-base)), 500ms, overlapping with step 3
  5. Sidebar slides in from the left: translateX -240→0, 300ms,
     easeExpo, starts 200ms into step 3
  6. Empty chat state fades upward: opacity 0→1, translateY 16→0,
     400ms, starts after sidebar settles
  7. Floating input bar springs into position: translateY 24→0,
     scale 0.96→1, spring easing, 350ms

Total transition: ~1.4s. Nothing is instant. Nothing is jarring.
This is the single most important animation sequence in the product
— it is what makes NEXUS feel like "one continuous world" rather
than a website with pages.
```

### App Shell Layout (post-login)

```
Flex row, full viewport, overflow hidden, background var(--bg-base)

Left sidebar: var(--sidebar-collapsed) collapsed / var(--sidebar-expanded)
  expanded, width transition 200ms var(--ease-expo)

Center: flex-1, flex column
  → Chat message list (scrollable, flex-1)
  → Floating input bar (sticky bottom, see Phase 2 v2 spec — unchanged)

No right inspector panel in this version. Document metadata (summary,
keywords, topics) is shown INLINE in the chat as an InlineDocumentCard
immediately after a file finishes processing — not in a separate panel.
```

### Sidebar — `AppSidebar.tsx` (this is the core structural change)

```
Background: var(--bg-surface)
Border-right: 1px solid var(--border)
Padding: 12px 8px
Flex column, height 100%, justify-content: space-between
  (top section grows, footer section pinned to bottom)

┌─ TOP SECTION (scrollable) ──────────────┐
│                                            │
│  NEXUS  (small wordmark, layoutId target) │
│                                            │
│  [+ New Chat]  ← full-width button,       │
│                  accent-tinted glass,      │
│                  plus icon, always visible │
│                                            │
│  ── Chat History ──                       │
│                                            │
│  Today                                     │
│    • Q3 report review                     │
│    • Untitled chat                        │
│  Yesterday                                 │
│    • Research notes summary               │
│  Previous 7 days                           │
│    • Lecture transcript Q&A               │
│                                            │
└────────────────────────────────────────┘
┌─ FOOTER (pinned, always visible) ────────┐
│  ⚙  Settings                              │
│  ⎋  Logout                                │
└────────────────────────────────────────┘

Collapsed state (icon only, 60px wide):
  NEXUS wordmark → shrinks to just "N" mark
  New Chat → icon only (plus in circle)
  Session list → hidden entirely (tooltip on hover shows session title)
  Footer → icon only, Settings gear + Logout icon

Expand trigger: hover (desktop) with 150ms delay before expanding,
  OR a persistent toggle button for users who want it pinned open.
  Width transition: 200ms var(--ease-expo)
  Labels: opacity 0→1, translateX -8→0, 150ms, delayed 80ms after
  width starts expanding (never let text appear before there's room)
```

### New Chat Button

```
Full width, height 40px, background var(--accent-dim),
border 1px solid rgba(124,58,237,0.25), border-radius var(--r-md)
Icon: Plus (Lucide), 16px
Label: "New Chat", 13px weight 500, var(--text-1)

Hover: background → rgba(124,58,237,0.18), 150ms
Click: creates new session, navigates to /chat (no page reload,
  client-side transition only), Anime.js scale pulse 1→0.97→1, 150ms
```

### Session List — grouped by date

```
Group headers: "Today" / "Yesterday" / "Previous 7 days" / "Older"
  11px, uppercase, letter-spacing 0.05em, var(--text-4)

Each SessionItem:
  Height 36px, padding 0 10px, border-radius var(--r-md)
  Title: 13px, var(--text-2), truncated with ellipsis
  Active session: background var(--bg-active), left 2px accent border,
    text color var(--text-1)
  Hover: background var(--bg-hover), 100ms
  Right-click or hover-reveal: rename / delete icons fade in (Anime.js
    opacity 0→1, 150ms)

Loading state: skeleton shimmer rows (accent-tinted, see Phase 8 spec)
```

### Sidebar Footer — Settings + Logout (always pinned, never scrolls away)

```
Fixed to bottom of sidebar, border-top 1px solid var(--border),
padding 8px

Settings row:
  Icon: Settings/gear (Lucide), 16px, var(--text-3)
  Label: "Settings", 13px, var(--text-2)
  Click: opens SettingsModal (glass modal, see below) — NOT a route

Logout row:
  Icon: LogOut (Lucide), 16px, var(--error) at 70% opacity
  Label: "Logout", 13px, var(--text-2)
  Click: confirmation via Sonner toast with undo-style action,
    then clears session and returns to landing page (full reset —
    cosmic scene re-initializes)

Both rows: hover background var(--bg-hover), 100ms, same as session items
```

### Settings Modal — `SettingsModal.tsx`

```
Glass modal, same visual language as AuthModal (Phase 2 spec) but
larger: 560px wide, max-height 80vh, scrollable content

Sections (tabs or accordion — agent choice, but must include ALL of
these, no page navigation required to reach any of them):

  General
    Display name, avatar
    Theme: Dark / Light / System (icon cards)
    Font size: Small / Default / Large (live preview)

  AI Model
    Provider toggle: Cloud AI vs Local AI (if offline mode supported)
    Model selector dropdowns
    ⚠ warning banner if changing embedding model (re-index required)

  Privacy
    Data usage toggle
    Delete all conversations (danger zone, red-bordered card,
      requires typing "DELETE" to confirm)

  Usage
    Token usage this month (progress bar, accent fill, colour shifts
      amber >80%, red >95%)
    Documents indexed count
    Total conversations count

Background behind modal: entire chat interface scales 1→0.98 and
  dims slightly (brightness 0.85), matching "macOS" modal behaviour
  from the animation brief. Reverses on close.
```

### File Upload — Inline in Chat (Claude/ChatGPT pattern, no library page)

```
Two entry points, both leading to the same flow:

1. Attach button in the floating input bar (paperclip icon)
   → opens native file picker
2. Drag any file anywhere onto the chat window
   → UploadDropZone overlay appears: full-screen dashed border,
     background dims, "Drop to upload" text centered
   → matches brief: "background slightly brightens... upload area
     expands... document card flies into chat input... like
     Apple AirDrop"

On file selected/dropped:
  1. A DocumentChip appears in the input bar immediately (optimistic UI)
     — Anime.js chipIn(): scale 0.8→1, opacity 0→1, translateY 4→0,
     250ms easeOutBack
  2. Chip shows: file icon, filename, animated spinner ring
  3. Upload begins in background (POST to existing backend endpoint,
     unchanged from prior plan)
  4. On processing complete (Supabase Realtime): chip spinner
     transitions to checkmark, 300ms
  5. An InlineDocumentCard appears in the message list (not a modal,
     not a separate panel) — shows: summary (2-3 sentences), key
     topics as small pills, page count, and 3 suggested action chips
     ("Summarise this", "Quiz me on this", "Extract key notes")
  6. User can now ask questions immediately — the doc is in scope
     for the active session automatically
```

---

## PHASE 4 — Backend Integration (unchanged rules from v2)

**STRICT RULES:**
- DO NOT modify any backend file
- DO NOT change API routes or response formats
- Frontend adapts to backend, not the reverse

Same `lib/api.ts`, `hooks/useStream.ts`, `hooks/useRealtime.ts` as
previously specified. Same error state handling table:

```
Upload fails:       Toast "Upload failed. Try again." + retry button
Parse error:        Inline card shows red state + "Parse failed" + retry
No API key:         Banner at chat top "AI service unavailable"
Rate limited:       Toast "Too many requests. Please wait 60 seconds."
Network offline:    Full-width banner "You are offline."
Empty retrieval:    Assistant message: "No relevant content found."
Session not found:  Redirect to new chat, toast "Session expired"
```

---

## PHASE 5 — ChatGPT-Level AI Experience (unchanged from v2)

Markdown renderer, citation preview, streaming cursor, follow-up
chips — all identical to v2 spec. No changes needed here since this
was already chat-focused.

---

## PHASE 6 — Removed / Merged Into Phase 3

The old Phase 6 (Library page, Knowledge Map page, suggested actions)
is now folded into Phase 3's inline document handling. There is no
separate route for any of this in the current architecture.

If a knowledge map or library grid is wanted later, it becomes an
optional **Phase 10 — Extended Surfaces**, added only after the core
chat-first product is complete and polished.

---

## PHASE 7 — Motion & Polish

All micro-interactions from v2 remain valid (sidebar hover, button
states, message entrance, etc.) with these additions specific to the
cosmic landing:

```
Ring rotation:          90-120s linear infinite
Aurora drift:            60-100s ease-in-out infinite alternate
Floor bloom breathing:   8s ease-in-out infinite
Shard orbit + rotation:  18-24s per shard, randomized, infinite
CTA button breathing:    4s ease-in-out infinite (interrupted by hover)
Feature card float:      6-9s per card, sine wave, infinite
Mouse parallax:          3-tier depth (2px / 10px / 20px), 60fps
Idle easter egg:         30-60s trigger, once per session
Login transition:        ~1.4s total, multi-stage, see Phase 3
```

Every one of the above must respect `prefers-reduced-motion`: when
active, reduce all infinite/ambient animations to either static
(no motion) or a single, much slower, subtler cycle. Never disable
functional feedback animations (hover, click) — only ambient ones.

---

## PHASE 8 — Production Optimisation (unchanged from v2)

```
□ CosmicBackground, FloatingShards use next/dynamic ssr:false
□ Canvas starfield renders once, never re-renders on state change
□ All images use next/image; icons are inline SVG
□ Anime.js tree-shaken, only imported functions used
□ Bundle target: < 200KB first load JS (cosmic scene is CSS/SVG/
  Canvas — no heavy 3D library needed, keeps bundle lean)
□ Font loading: next/font, display swap, preloaded
□ TanStack Query caching for session list and messages
□ prefers-reduced-motion respected everywhere (see Phase 7)
```

---

## PHASE 9 — Delight & Identity (updated for new architecture)

```
1. Wordmark morph — Framer layoutId="nexus-wordmark" travels:
   center-stage hero (200px) → auth modal (18px) → sidebar (16-18px,
   collapsed to "N" only). Three waypoints now, not two.

2. Input bar glows while AI thinks — anim.glowPulse(), unchanged
   from v2 spec.

3. Documents animate into input as glass chips — unchanged, but now
   this IS the primary upload UX (no separate library), so this
   interaction gets used constantly — must feel flawless.

4. Citations highlight source on hover — unchanged from v2.

5. Processing animation — unchanged ring/checkmark spec, but now
   the completed InlineDocumentCard is what appears in the chat feed
   itself rather than a library grid.

6. Empty states —
   Empty chat: NEXUS mark + rotating suggestion prompts (from the
   animation brief: "Summarize my document → Create flashcards →
   Generate quiz → Explain simply", each fading in/out every few
   seconds, one at a time, not all simultaneously)
   No sessions yet: single ghost "Start a new conversation" item

7. Idle easter egg on landing — fully specified in Phase 2, section 10.

8. Micro-identity: accent-tinted scrollbar, custom selection colour,
   accent focus rings, dynamic page titles per session — all
   unchanged from v2.
```

---

## IMPLEMENTATION NOTES FOR AI AGENTS

### Architecture change summary (read before starting)
```
REMOVED from v2 plan:
  - /workspace route and page
  - /library route, DocumentGrid, DocumentCard as a standalone page
  - /map route and KnowledgeMap component
  - /analytics route
  - Right InspectorPanel as a persistent UI element
  - Spline references (already removed in v2, confirmed gone in v3)

ADDED in v3:
  - Full cosmic landing page spec (ring, bloom, shards, starfield)
  - Idle easter egg system
  - Sidebar-first chat architecture (Claude/ChatGPT pattern)
  - InlineDocumentCard (replaces the library page's DocumentCard)
  - SettingsModal (replaces the /settings route)
  - Three-waypoint wordmark morph (was two in v2)

UNCHANGED from v2:
  - Tech stack and versions
  - Design tokens (extended, not replaced)
  - Phase 4, 5 (backend integration, AI chat experience)
  - Anime.js / Framer Motion role separation
  - Accessibility and performance requirements
```

### Zero Error Policy (same as v2)
```bash
tsc --noEmit
next build
next start   # check console for zero runtime errors
```
Fix all errors before proceeding to the next phase.

---

## SUMMARY TABLE

| Phase | Focus | No Backend | Deliverable |
|-------|-------|-----------|-------------|
| 1 | Design system | ✓ | Tokens, types, stores, providers |
| 2 | Cosmic landing | ✓ | Ring, bloom, shards, wordmark, auth modal |
| 3 | Chat-first shell | ✓ | Sidebar, chat, inline uploads, settings modal |
| 4 | Backend integration | ✗ | Auth, upload, chat, streaming |
| 5 | AI chat experience | ✗ | Markdown, citations, streaming |
| 7 | Motion & polish | ✗ | All micro + ambient interactions |
| 8 | Production | ✗ | Performance, a11y, zero errors |
| 9 | Delight & identity | ✗ | Signature moments, easter egg |

*(Phase 6 merged into Phase 3. Phase 10 — Extended Surfaces — reserved
for future library/map additions if desired later.)*

---

*NEXUS Frontend Master Plan — v3.0 — Cosmic Landing + Chat-First Architecture*
