# Architecture

## Data flow overview

```mermaid
flowchart LR
    User([User]) -->|enters claim| Home[/"/" Home page/]
    Home -->|POST /debates| API[[paper-trail-backend<br/>FastAPI + LangGraph]]
    API -->|debate_id| DebatePage[/"/debates/[id]" page/]
    DebatePage -->|SSE /debates/:id/stream| Hook[useDebateStream hook]
    Hook -->|validated events| Store[(Zustand store)]
    Store --> Arena[DebateArena]
    Arena --> ProPanel[Pro AgentPanel]
    Arena --> ConPanel[Con AgentPanel]
    Store --> Verdict[JudgeVerdict]
    Store --> Confidence[ConfidenceBar]
    DebatePage -->|link| Transcript[/"/debates/[id]/transcript"/]
    Transcript -->|GET /debates/:id| API
```

## Component map

| Layer | Files | Responsibility |
|---|---|---|
| **Pages** | `app/page.tsx`, `app/debates/[id]/page.tsx`, `app/debates/[id]/transcript/page.tsx` | Routing, server-side data fetching, layout composition |
| **Home widgets** | `app/_home/` | Co-located client components for the claim input page |
| **Components** | `AgentPanel`, `DebateArena`, `ClaimInput`, `ConfidenceBar`, `EvidenceCard`, `JudgeVerdict`, `TranscriptView`, `TypewriterMarkdown`, `BackendStatus` | Presentational components with typed props, loading + error states |
| **Terminal UI** | `components/terminal/` | Terminal-themed wrapper components for the debate aesthetic |
| **Hooks / state** | `lib/sse.ts` (SSE consumer with reconnect + backoff), `lib/store.ts` (Zustand) | Streaming event ingestion, client-side state management |
| **API client** | `lib/api.ts` | TanStack Query wrappers around REST endpoints, typed fetch helpers |
| **Validation** | `lib/env.ts` (env vars), `lib/schemas.ts` (wire payloads) | Zod schemas for runtime validation at every boundary |
| **Utilities** | `lib/transcript.ts`, `lib/utils.ts` | Transcript formatting, cn() classname helper |
| **UI primitives** | `components/ui/*` | shadcn/ui components (Button, Card, Skeleton, etc.) |

## Full data flow

```mermaid
flowchart TD
    subgraph HomePage ["/ (Home)"]
        ClaimInput[ClaimInput] -->|claim text| POST["POST /debates"]
    end

    POST -->|201 debate_id| Navigate["router.push(/debates/[id])"]

    subgraph DebateView ["/debates/[id]"]
        Mount["page mount"] --> SSEHook["useDebateStream(id)"]
        SSEHook -->|EventSource| Backend["Backend SSE endpoint"]
        Backend -->|typed SSE frames| Validate["zod schema validation"]
        Validate -->|valid events| ZustandStore["Zustand store<br/>(discriminated union state)"]
        Validate -.->|unknown events| Log["console.warn + drop"]
        ZustandStore --> ArenaView["DebateArena<br/>+ AgentPanel x2"]
        ZustandStore --> VerdictView["JudgeVerdict"]
        ZustandStore --> ConfBar["ConfidenceBar"]
    end

    subgraph TranscriptPage ["/debates/[id]/transcript"]
        Fetch["GET /debates/:id"] --> TranscriptComp["TranscriptView"]
    end

    DebateView -->|link after complete| TranscriptPage
```

## SSE lifecycle

```mermaid
sequenceDiagram
    participant Page as DebatePage
    participant Hook as useDebateStream
    participant ES as EventSource
    participant Zod as schemas.ts
    participant Store as Zustand store
    participant UI as DebateArena

    Page->>Hook: mount(debateId)
    Hook->>Store: set phase = "connecting"
    Hook->>ES: new EventSource(/debates/:id/stream)

    ES-->>Hook: event: plan_complete
    Hook->>Zod: parse(payload)
    Zod-->>Hook: validated PlanEvent
    Hook->>Store: dispatch(planComplete)
    Store->>UI: re-render with plan data

    par Parallel agent events
        ES-->>Hook: event: proponent_argument
        Hook->>Store: dispatch(proponentArg)
    and
        ES-->>Hook: event: skeptic_argument
        Hook->>Store: dispatch(skepticArg)
    end
    Store->>UI: re-render Arena panels

    ES-->>Hook: event: judge_verdict
    Hook->>Store: dispatch(verdict), phase = "complete"
    Store->>UI: render JudgeVerdict

    ES-->>Hook: event: debate_complete
    Hook->>ES: close()
    Hook->>Store: phase = "complete"
    Store->>UI: show transcript link
```

## Invariants

1. **SSE payloads validated before store** -- every event passes through a zod discriminated union in `schemas.ts`. Unknown event types are logged and dropped, never rendered.
2. **Discriminated union state** -- the Zustand store models debate phase as `idle | connecting | streaming | complete | error`. Illegal transitions are unrepresentable; components pattern-match on phase.
3. **Env validated at import** -- `env.ts` throws at import time if required env vars (`NEXT_PUBLIC_API_URL`, etc.) are missing. No silent `undefined` leaking into fetch URLs.
4. **Typed props everywhere** -- all components receive explicitly typed props; no `any` crosses module boundaries.
5. **Server/client boundary** -- pages are server components that fetch initial data; interactivity lives in `"use client"` components and hooks.

## Testing architecture

| Layer | Tool | Pattern |
|---|---|---|
| **Component unit tests** | Vitest + jsdom + React Testing Library | `tests/components/*.test.tsx` -- render in isolation, assert on accessible roles and text content |
| **Hook / lib unit tests** | Vitest + jsdom | `tests/lib/*.test.ts` -- SSE tested via `FakeEventSource` mock, schemas tested with valid/invalid fixtures |
| **SSE hardening** | `FakeEventSource` (`tests/lib/fake-event-source.ts`) | Simulates event streams, connection drops, and malformed payloads without a real backend |
| **Schema hardening** | `tests/lib/schemas-hardening.test.ts` | Ensures zod schemas reject malformed payloads, unknown fields, and type mismatches |
| **E2E** | Playwright | `tests/e2e/debate-flow.spec.ts` -- full claim-to-verdict flow against a running backend |
| **Smoke** | Vitest | `tests/smoke.test.ts` -- basic import/render sanity check |

Test commands: `pnpm test` (Vitest unit + lib), `pnpm test:e2e` (Playwright).
