<div align="center">

# `paper-trail-frontend`

### _Next.js 16 UI for a LangGraph multi-agent debate arena._

<p>
  <em>Terminal-styled front-end. Live SSE streaming. Every verdict comes with a receipt.</em>
</p>

<p>
  <a href="https://paper-trail-backend-7h27.onrender.com">Backend API</a> •
  <a href="https://github.com/Abdul-Muizz1310/paper-trail-backend">Backend Repo</a> •
  <a href="#run-locally">Quickstart</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#testing">Testing</a>
</p>

<p>
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="next"/>
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black" alt="react"/>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="ts"/>
  <img src="https://img.shields.io/badge/Tailwind-v4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white" alt="tailwind"/>
  <img src="https://img.shields.io/badge/Zod-boundaries-3068b7?style=flat-square" alt="zod"/>
  <img src="https://img.shields.io/badge/Vercel-deployed-000000?style=flat-square&logo=vercel&logoColor=white" alt="vercel"/>
</p>

<p>
  <img src="https://img.shields.io/badge/tests-Vitest%20+%20Playwright-6e9f18?style=flat-square" alt="tests"/>
  <img src="https://img.shields.io/badge/lint-Biome-60a5fa?style=flat-square" alt="biome"/>
  <img src="https://img.shields.io/badge/react--compiler-enabled-ff69b4?style=flat-square" alt="rc"/>
  <img src="https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square" alt="license"/>
</p>

</div>

---

```console
$ pnpm dev
  ▲ Next.js 16.0.0 (Turbopack)
  - Local:   http://localhost:3000
  - API:     https://paper-trail-backend-7h27.onrender.com

[home]     claim input armed · backend status: warm ●
[debate]   SSE /debates/<id>/stream opened · 5 retries budget
[arena]    round 1 · proponent ● · skeptic ●
[judge]    confidence 0.91 · verdict FALSE · done ✓
[transcript] /debates/<id>/transcript rendered
```

---

## `whoami`

The **paper-trail** front-end. Users type a claim; the UI spawns a debate on the FastAPI backend, subscribes to its **Server-Sent Events** stream, and renders two agents arguing in real time with inline citations. A judge renders its verdict and confidence live. The full markdown transcript is one click away — auditable, copyable, permalinked.

The whole app is wrapped in a **terminal-window aesthetic**: grid backgrounds, scanlines, status dots, monospace fonts, shell-path section headers. Dark mode only. No skeumorphic chrome — just the feel of watching a pipeline run.

> Backend: [`paper-trail-backend`](https://github.com/Abdul-Muizz1310/paper-trail-backend) — deployed at `paper-trail-backend-7h27.onrender.com`.

---

## `cat features.txt`

```diff
+ Live SSE streaming of pro/con/judge rounds
+ Automatic reconnect with exponential backoff (5 retries, cap 8s)
+ Safety-net polling fallback (3s) while streaming
+ Zod validation at every external boundary (API, env, SSE events)
+ TanStack Query cache patched in-place from SSE payloads (no refetch)
+ Typewriter markdown rendering for live reveal
+ Deterministic transcript view with judge reasoning extraction
+ Backend health indicator with cold-start detection
+ Terminal-style UI chrome (grid, scanlines, status dots)
+ React 19 + React Compiler enabled
```

---

## `tree -L 2 src/`

```
src/
├── app/
│   ├── page.tsx                      # Home: claim input + feature cards
│   ├── layout.tsx                    # Root layout + metadata
│   ├── providers.tsx                 # TanStack Query provider
│   ├── globals.css                   # Tailwind + terminal CSS (grid, scanlines)
│   ├── _home/
│   │   └── HomeClaimForm.tsx         # Client form container
│   └── debates/[id]/
│       ├── page.tsx                  # SSR wrapper (UUID validation)
│       ├── DebateView.tsx            # SSE orchestrator + cache sync
│       └── transcript/
│           ├── page.tsx              # SSR wrapper
│           └── TranscriptClient.tsx  # Markdown transcript viewer
├── components/
│   ├── DebateArena.tsx               # Two-column pro/con grid
│   ├── AgentPanel.tsx                # Per-agent rounds list
│   ├── EvidenceCard.tsx              # Citation card w/ quote + source
│   ├── JudgeVerdict.tsx              # Verdict + confidence + reasoning
│   ├── ConfidenceBar.tsx             # Animated confidence meter
│   ├── TypewriterMarkdown.tsx        # Animated markdown reveal
│   ├── TranscriptView.tsx            # Full markdown viewer
│   ├── ClaimInput.tsx                # Form + max-rounds control
│   ├── BackendStatus.tsx             # Cold / warm / down indicator
│   ├── terminal/                     # Terminal window, prompt, nav, status bar
│   └── ui/                           # shadcn primitives
└── lib/
    ├── env.ts                        # Runtime env validation (Zod)
    ├── api.ts                        # TanStack Query hooks + fetch
    ├── sse.ts                        # useDebateStream() EventSource hook
    ├── schemas.ts                    # Zod schemas + parseRounds/normaliseSide bridge
    ├── transcript.ts                 # extractJudgeReasoning()
    └── utils.ts                      # cn() (clsx + tailwind-merge)
```

> **Rule**: `app/` routes are thin. Components are dumb. All side effects live in `lib/`.

---

## `./architecture`

```
┌──────────────┐      POST /debates       ┌───────────────────────┐
│  HomeForm    │ ───────────────────────► │  paper-trail-backend  │
└──────┬───────┘                          │   (FastAPI on Render) │
       │ router.push                      └──────────┬────────────┘
       ▼                                             │
┌──────────────┐                                     │
│  DebateView  │  ◄── GET /debates/{id}/stream ──────┘   (SSE)
└──────┬───────┘            │
       │                    ├─ state  { verdict, confidence, rounds? }
       │                    ├─ done   { verdict, confidence, transcript_md }
       │                    └─ error  { reason }
       │
       │ useDebateStream()           useDebate()
       │      │                          │
       ▼      ▼                          ▼
  ┌──────────────────┐          ┌───────────────────┐
  │   TanStack       │ ◄─patch─ │  Zod-validated    │
  │   Query cache    │          │  snapshot + poll  │
  └────────┬─────────┘          └───────────────────┘
           │
           ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │ DebateArena  │   │ JudgeVerdict │   │ TranscriptView│
    └──────────────┘   └──────────────┘   └──────────────┘
```

**Streaming model:** SSE is the primary transport. A 3-second polling fallback runs alongside as a safety net. When the backend inlines `rounds[]` in `state` events, the cache is patched directly — no refetch round-trip.

**Reconnect logic ([`src/lib/sse.ts`](src/lib/sse.ts)):** 5-retry budget, exponential backoff `min(500ms · 2^attempt, 8000ms)`. Terminated on `done`, `error: not_found`, or unmount. Terminal refs prevent stale closures; timers cleaned up on every path.

**Zod at every boundary:**
- `env.ts` — validates `NEXT_PUBLIC_*` at import time
- `api.ts` — `DebateSchema.parse()` / `DebateCreateOutSchema.parse()` on every fetch
- `sse.ts` — `StateEventSchema`, `DoneEventSchema`, `ErrorEventSchema` on every event

---

## `./stack --print`

<table>
<tr><td><strong>Framework</strong></td><td>Next.js 16 (App Router, React Server Components, React Compiler)</td></tr>
<tr><td><strong>UI</strong></td><td>React 19 · TypeScript strict</td></tr>
<tr><td><strong>Styling</strong></td><td>Tailwind CSS v4 · shadcn/ui · radix-ui · lucide · Framer Motion</td></tr>
<tr><td><strong>State</strong></td><td>TanStack Query v5 · Zustand</td></tr>
<tr><td><strong>Validation</strong></td><td>Zod (env, API, SSE)</td></tr>
<tr><td><strong>Markdown</strong></td><td>react-markdown + remark-gfm</td></tr>
<tr><td><strong>Testing</strong></td><td>Vitest + Testing Library (unit) · Playwright (e2e)</td></tr>
<tr><td><strong>Lint / Format</strong></td><td>Biome (replaces ESLint + Prettier)</td></tr>
<tr><td><strong>Hosting</strong></td><td>Vercel</td></tr>
</table>

---

## `./routes`

| Route | Purpose |
|---|---|
| `/` | Home — claim input, feature cards, backend status |
| `/debates/[id]` | Live debate arena — SSE streaming pro/con/judge |
| `/debates/[id]/transcript` | Full deterministic markdown transcript |

---

## Run locally

```bash
# 1. clone & install
git clone https://github.com/Abdul-Muizz1310/paper-trail-frontend.git
cd paper-trail-frontend
pnpm install

# 2. env
cp .env.example .env.local
# edit NEXT_PUBLIC_API_URL if backend runs elsewhere

# 3. dev
pnpm dev
# → http://localhost:3000
```

### Environment

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | FastAPI backend base URL (SSE + REST) |
| `NEXT_PUBLIC_SITE_URL` | Public canonical URL (OG tags, absolute links) |

Validated at import time in [`src/lib/env.ts`](src/lib/env.ts) via Zod. Missing vars crash boot — **parse, don't validate**.

### Scripts

```bash
pnpm dev          # Next.js dev server
pnpm build        # production build
pnpm start        # production server
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright e2e
pnpm lint         # Biome check
pnpm format       # Biome write
```

---

## Testing

```bash
pnpm test                    # watch
pnpm test -- --run           # CI
pnpm test -- --coverage      # coverage report
pnpm test:e2e                # Playwright chromium
```

<table>
<tr><td><strong>Unit tests</strong></td><td>37 tests across 9 files (Vitest + jsdom)</td></tr>
<tr><td><strong>E2E</strong></td><td>Playwright chromium, fixture <code>tests/e2e/fixtures/transcript.md</code></td></tr>
<tr><td><strong>SSE suite</strong></td><td>Property suite P1–P6 + failure suite F1–F7 (14 cases: lifecycles, retries, cleanup, backoff)</td></tr>
<tr><td><strong>Methodology</strong></td><td>Red-first spec-TDD. Zod-validated discriminated unions instead of defensive runtime checks.</td></tr>
</table>

### Roadmap to 100% coverage

Components tested: `AgentPanel`, `ClaimInput`, `ConfidenceBar`, `DebateArena`, `EvidenceCard`, `JudgeVerdict`, `TranscriptView`.

Gaps:

| Target | Why it matters |
|---|---|
| `BackendStatus.tsx` | Cold-start detection is user-facing; status discriminated union (`checking / cold / warm / down`) untested |
| `TypewriterMarkdown.tsx` | Animation timing + `onDone` ref callback untested |
| `app/debates/[id]/DebateView.tsx` | Central orchestrator — SSE + cache mutation + polling fallback |
| `app/_home/HomeClaimForm.tsx` | Mutation → router.push, error recovery via `lastClaim` |
| `app/debates/[id]/transcript/TranscriptClient.tsx` | Pending/error/ready states |
| `lib/api.ts` | Query staleness, mutation, cache invalidation semantics |
| `lib/transcript.ts` | `extractJudgeReasoning()` section regex + fallback |

### Hardening backlog

- [ ] Timeout on initial SSE connection (cap `connecting` phase at 10s)
- [ ] Random jitter on reconnect backoff (avoid thundering herd)
- [ ] `ErrorEventSchema` as discriminated union on `reason`
- [ ] Production log of dropped rounds (not just dev warnings)

---

## `./philosophy`

| Principle | How it shows up |
|---|---|
| **Spec-TDD** | SSE hook shipped with P1–P6 / F1–F7 test matrix before implementation landed. |
| **Negative-space programming** | Discriminated unions for `StreamPhase`, `BackendStatus`, `DebatePhase`. Malformed SSE events dropped silently. Unknown sides return `null` via `normaliseSide()`. |
| **Parse, don't validate** | Zod at every edge: env, REST, SSE. No `any`, no unsafe casts, no optional-chain bug masks. |
| **Separation of concerns** | `app/` thin · `components/` dumb · `lib/` owns side effects. |
| **Typed everything** | TS strict; Zod-inferred types flow end-to-end; no untyped dicts across module boundaries. |
| **Pure core, imperative shell** | `parseRounds`, `extractJudgeReasoning`, schema transforms = pure. SSE + Query = imperative shell, isolated in `lib/`. |

---

## Deploy

Hosted on **Vercel**. Push to `main` → Vercel build → preview URL → promote to prod.

Required env vars at build time:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`

Next config: `reactCompiler: true`.

---

## License

MIT. See [LICENSE](LICENSE).

<div align="center">

---

**`$ paper-trail-ui --help`** · streaming debates, typed end-to-end

</div>
