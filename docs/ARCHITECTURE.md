# Architecture

```mermaid
flowchart LR
    User([User]) -->|enters claim| Home[/"/" (Home)/]
    Home -->|POST /debates| API[[paper-trail-backend<br/>FastAPI + LangGraph]]
    API -->|debate_id| DebatePage[/"/debates/[id]"/]
    DebatePage -->|SSE /debates/:id/stream| SSEHook[useDebateStream]
    SSEHook --> Store[(Zustand debate store)]
    Store --> Arena[DebateArena]
    Arena --> ProPanel[Pro AgentPanel]
    Arena --> ConPanel[Con AgentPanel]
    Store --> Verdict[JudgeVerdict]
    DebatePage -->|link| Transcript[/"/debates/[id]/transcript"/]
    Transcript -->|GET /debates/:id| API
```

## Component map

| Layer | Files | Responsibility |
|---|---|---|
| **Pages** | `src/app/page.tsx`, `src/app/debates/[id]/page.tsx`, `src/app/debates/[id]/transcript/page.tsx` | Routing + server-side data fetching |
| **Components** | `src/components/ClaimInput.tsx`, `DebateArena.tsx`, `AgentPanel.tsx`, `ConfidenceBar.tsx`, `EvidenceCard.tsx`, `JudgeVerdict.tsx`, `TranscriptView.tsx` | Presentational, typed props, loading + error states |
| **Hooks / state** | `src/lib/sse.ts` (SSE consumer with reconnect), `src/lib/store.ts` (Zustand) | Streaming event ingestion |
| **API client** | `src/lib/api.ts` | TanStack Query wrappers around REST endpoints |
| **Validation** | `src/lib/env.ts`, `src/lib/schemas.ts` | zod schemas for env + wire payloads |
| **UI primitives** | `src/components/ui/*` | shadcn/ui |

## Invariants

- All SSE payloads pass through a zod schema before hitting the store — unknown event types are logged and dropped, never rendered.
- The store is a discriminated union over debate phases (`idle | connecting | streaming | complete | error`). Illegal transitions are unrepresentable.
- `env.ts` throws at import time if required env vars are missing — no silent `undefined` leaking into fetch URLs.
