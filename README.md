# 📰 `paper-trail-frontend`

> ⚡ **Next.js 16 UI for a LangGraph multi-agent debate arena.**
> Terminal-styled front-end. Live SSE streaming. Every verdict comes with a receipt.

🌐 Live UI: [paper-trail-frontend-sable.vercel.app](https://paper-trail-frontend-sable.vercel.app) · 🔌 [Backend API](https://paper-trail-backend-jjpf.onrender.com) · 🔙 [Backend Repo](https://github.com/Abdul-Muizz1310/paper-trail-backend) · 🚀 [Quickstart](#-run-locally) · 🏗️ [Architecture](#️-architecture) · 🧪 [Testing](#-testing)

![next](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![react](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)
![ts](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)
![tailwind](https://img.shields.io/badge/Tailwind-v4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)
![zod](https://img.shields.io/badge/Zod-boundaries-3068b7?style=flat-square)
![vercel](https://img.shields.io/badge/Vercel-deployed-000000?style=flat-square&logo=vercel&logoColor=white)
![tests](https://img.shields.io/badge/tests-357%20Vitest-6e9f18?style=flat-square)
![biome](https://img.shields.io/badge/lint-Biome-60a5fa?style=flat-square)
![rc](https://img.shields.io/badge/react--compiler-enabled-ff69b4?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)

---

```console
$ pnpm dev
  ▲ Next.js 16.0.0 (Turbopack)
  - Local:   http://localhost:3000
  - API:     https://paper-trail-backend-jjpf.onrender.com

[home]       claim input armed · backend status: warm ●
[debate]     SSE /debates/<id>/stream opened · 5 retries budget
[arena]      round 1 · proponent ● · skeptic ●
[judge]      confidence 0.91 · verdict FALSE · done ✓
[transcript] /debates/<id>/transcript rendered
```

---

## 🎯 What it is

The **paper-trail** front-end. Users type a claim; the UI spawns a debate on the FastAPI backend, subscribes to its **Server-Sent Events** stream, and renders two agents arguing in real time with inline citations. A judge renders its verdict and confidence live. The full markdown transcript is one click away — auditable, copyable, permalinked.

The whole app is wrapped in a **terminal-window aesthetic**: grid backgrounds, scanlines, status dots, monospace fonts, shell-path section headers. Dark mode only. No skeuomorphic chrome — just the feel of watching a pipeline run.

> 🔙 Backend: [`paper-trail-backend`](https://github.com/Abdul-Muizz1310/paper-trail-backend) — deployed at `paper-trail-backend-jjpf.onrender.com`.

---

## ✨ Features

- 📡 Live SSE streaming of pro/con/judge rounds
- 🔁 Automatic reconnect with exponential backoff (5 retries, cap 8s), and the stream is renewed when the backend cuts it at its 120 s cap, so a long debate still reaches its verdict
- 🧯 A debate that fails says so (`debate-failed` alert) instead of looking stalled
- 🛟 Safety-net polling fallback (3s) while streaming
- 🛡️ Zod validation at every external boundary (API, env, SSE events)
- ⚡ TanStack Query cache patched in-place from SSE payloads (no refetch during streaming; one refetch on terminal to pull the transcript)
- ⌨️ Typewriter markdown rendering for live reveal
- 📝 Deterministic transcript view with judge reasoning extraction
- 💤 Backend health indicator with cold-start detection
- 🖥️ Terminal-style UI chrome (grid, scanlines, status dots)
- ⚛️ React 19 + React Compiler enabled

---

## 🏗️ Architecture

```mermaid
flowchart TD
    Home[HomeClaimForm] -->|POST /api/backend/debates| Proxy["/api/backend/... route<br/>signs X-Platform-Token"]
    Proxy -->|signed, streamed| Backend[(paper-trail-backend<br/>FastAPI on Render)]
    Home -->|router.push| DebateView[DebateView]
    DebateView -->|SSE /api/backend/debates/:id/stream| Proxy
    DebateView -->|useDebate snapshot + poll| Query[TanStack Query cache]
    Proxy -->|state events| DebateView
    DebateView -->|patch| Query
    Query --> Arena[DebateArena]
    Query --> Verdict[JudgeVerdict]
    Query --> Transcript[TranscriptView]
```

### 📡 SSE lifecycle

```mermaid
sequenceDiagram
    participant UI as DebateView
    participant Hook as useDebateStream
    participant ES as EventSource
    participant API as Backend

    UI->>Hook: mount(debate_id)
    Hook->>ES: new EventSource(stream_url)
    ES->>API: GET /debates/:id/stream
    loop every round
        API-->>ES: event: state { verdict, rounds? }
        ES-->>Hook: onMessage(state)
        Hook->>Hook: StateEventSchema.parse
        Hook-->>UI: patch TanStack cache
    end
    API-->>ES: event: done
    ES-->>Hook: close
    Hook-->>UI: phase = done
    UI->>Hook: unmount → cleanup
```

**Signed proxy:** the backend demands a platform token on every data route, and `EventSource` cannot send headers, so the browser never calls the backend's origin. Every call (`/health`, REST and the SSE stream) goes to the same-origin route `/api/backend/...`, which mints a 60-second Ed25519 token server-side (platform contract v2: `iss` `paper-trail-frontend`, `aud` `paper-trail`), forwards an allowlist of headers and streams the answer back unbuffered. See [spec 05](docs/specs/05-backend-proxy.md).

**Streaming model:** SSE is the primary transport. When the backend inlines `rounds[]` in `state` events (v0.1.1+), the cache is patched directly — **no refetch round-trip** while streaming. The only guaranteed `GET /debates/{id}` happens once on the terminal `done` phase to pull the final `transcript_md` (which `state` events don't carry). A 3-second polling fallback runs **only** for legacy backends that omit inline `rounds[]`; once inline rounds are observed the poll switches off so it can't storm the backend.

**Reconnect logic** ([`src/lib/sse.ts`](src/lib/sse.ts)): 5-retry budget, exponential backoff `min(500ms × 2^attempt, 8000ms)`. The backend closes every stream after 120 s with `done` + `reason: "timeout"` while the debate may still be running; that cut reopens the stream (up to 5 renewals) instead of ending it. Terminated on any other `done`, `error: not_found`, or unmount. Terminal refs prevent stale closures; timers cleaned up on every path.

**Zod at every boundary:**
- 🌱 `env.ts` — validates `NEXT_PUBLIC_*` at import time
- 🌐 `api.ts` — `DebateSchema.parse()` / `DebateCreateOutSchema.parse()` on every fetch
- 📡 `sse.ts` — `StateEventSchema`, `DoneEventSchema`, `ErrorEventSchema` on every event

---

## 🗂️ Project structure

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
    ├── backend-url.ts                # /api/backend prefix for browser calls
    ├── server/                       # server-only: token minting + backend proxy
    ├── api.ts                        # TanStack Query hooks + fetch
    ├── sse.ts                        # useDebateStream() EventSource hook
    ├── schemas.ts                    # Zod schemas + parseRounds/normaliseSide bridge
    ├── transcript.ts                 # extractJudgeReasoning()
    └── utils.ts                      # cn() (clsx + tailwind-merge)
```

> 📐 **Rule:** `app/` routes are thin. Components are dumb. All side effects live in `lib/`.

---

## 🛠️ Stack

| Concern | Choice |
|---|---|
| **Framework** | Next.js 16 (App Router, React Server Components, React Compiler) |
| **UI** | React 19 · TypeScript strict |
| **Styling** | Tailwind CSS v4 · shadcn/ui · radix-ui · lucide |
| **State** | TanStack Query v5 (server cache, patched live by the SSE consumer) |
| **Validation** | Zod (env, API, SSE) |
| **Markdown** | react-markdown + remark-gfm |
| **Testing** | Vitest + Testing Library (unit) · Playwright (e2e) |
| **Lint / Format** | Biome (replaces ESLint + Prettier) |
| **Hosting** | Vercel |

---

## 🗺️ Routes

| Route | Purpose |
|---|---|
| `/` | 🏠 Home — claim input, feature cards, backend status |
| `/debates/[id]` | ⚔️ Live debate arena — SSE streaming pro/con/judge |
| `/debates/[id]/transcript` | 📜 Full deterministic markdown transcript |

---

## 🚀 Run locally

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

### 🌱 Environment

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | FastAPI backend base URL, where the `/api/backend` proxy forwards (SSE + REST) |
| `NEXT_PUBLIC_SITE_URL` | Public canonical URL (OG tags, absolute links) |
| `PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE` | Server-only Ed25519 private key (PKCS#8 DER, base64) that signs the proxy's `X-Platform-Token`; the backend holds the public half |

The two `NEXT_PUBLIC_*` vars are validated at import time in [`src/lib/env.ts`](src/lib/env.ts) via Zod. Missing vars crash boot — **parse, don't validate**. The signing key is read per request: missing or malformed, the proxy answers 503 and never sends an unsigned call.

### 📜 Scripts

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

## 🧪 Testing

```bash
pnpm test                    # watch
pnpm test -- --run           # CI
pnpm test -- --coverage      # coverage report
pnpm test:e2e                # Playwright chromium
```

| Metric | Value |
|---|---|
| **Unit tests** | 357 tests (Vitest + jsdom; 356 passed, 1 skipped) |
| **Line coverage** | **92.4%** (608/658 lines over all `src/`) — including the SSE↔cache orchestrator `DebateView.tsx` (~94%), previously untested |
| **E2E** | Playwright chromium (mocked mode), fixture `tests/e2e/fixtures/transcript.md` — runs on every PR via the `e2e` CI job. UI specs fulfil `/api/backend/**` in the browser; `tests/e2e/proxy.spec.ts` drives the real proxy, unmocked, against a local mock backend that verifies every token with a throwaway key |
| **E2E live smoke** | `L1` scenario in `tests/e2e/debate-flow.spec.ts`, gated by `E2E_LIVE=1` — skipped on every normal PR run, run nightly (or `gh workflow run nightly-e2e.yml`) by `.github/workflows/nightly-e2e.yml` against the real Render backend through the signing proxy: one real 3-round debate to a `TRUE` verdict and its transcript, no retries (free-model quota). The job fails when the scenario fails |
| **Smoke** | `tests/smoke.test.ts` — env-gated live `GET /health` check against a deployed backend; skips unless `SMOKE_BASE_URL` is set. Not passed to the main `test` job (it always self-skips there); only the dedicated `smoke` job (`.github/workflows/ci.yml`, gated to `push`) receives it, from the `SMOKE_BASE_URL` repository variable |
| **SSE suite** | 35 cases (`tests/lib/sse.test.ts`): 9 pass cases (P1–P3, P5–P8, P16 ×2) + 26 failure cases (F1–F15 and sub-variants: lifecycles, retries, stream cuts, cleanup, backoff) |
| **Methodology** | Red-first spec-TDD. Zod-validated discriminated unions instead of defensive runtime checks. |
| **Bundle size** | Reproducible client bundle measurement — see [`benchmarks/bundle-size.md`](benchmarks/bundle-size.md) |

---

## 📐 Engineering philosophy

| Principle | How it shows up |
|---|---|
| 🧪 **Spec-TDD** | SSE hook shipped with a 28-case property/failure test matrix (P1–P3, P5, P6 + F1–F12 with sub-variants) before implementation landed. |
| 🛡️ **Negative-space programming** | Discriminated unions for `StreamPhase`, `BackendStatus`, `DebatePhase`. Malformed SSE events dropped silently. Unknown sides return `null` via `normaliseSide()`. |
| 🧬 **Parse, don't validate** | Zod at every edge: env, REST, SSE. No `any`, no unsafe casts, no optional-chain bug masks. |
| 🏗️ **Separation of concerns** | `app/` thin · `components/` dumb · `lib/` owns side effects. |
| 🔤 **Typed everything** | TS strict; Zod-inferred types flow end-to-end; no untyped dicts across module boundaries. |
| 🌊 **Pure core, imperative shell** | `parseRounds`, `extractJudgeReasoning`, schema transforms = pure. SSE + Query = imperative shell, isolated in `lib/`. |

---

## 🚀 Deploy

Hosted on **Vercel**. Push to `main` → Vercel build → preview URL → promote to prod.

> **Production URL:** live at [paper-trail-frontend-sable.vercel.app](https://paper-trail-frontend-sable.vercel.app)
> (see the header link above). `NEXT_PUBLIC_SITE_URL` is set to that URL in the
> production Vercel environment; it only falls back to `http://localhost:3000`
> in local dev and CI.

Required env vars at build time:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`

Required at runtime (server-only, never `NEXT_PUBLIC_`): `PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE`.

Next config: `reactCompiler: true`.

---

## 📄 License

MIT. See [LICENSE](LICENSE).

---

> ⚡ **`paper-trail-ui --help`** · streaming debates, typed end-to-end
