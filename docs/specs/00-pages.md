# Spec 00 — Pages

## Scope

Three routes that together deliver the core flow: enter a claim → watch the debate stream → read the permanent transcript.

| Route | File | Rendering |
|---|---|---|
| `/` | `src/app/page.tsx` | Server Component (static) — marketing + `<ClaimInput />` client island |
| `/debates/[id]` | `src/app/debates/[id]/page.tsx` | Client boundary — uses SSE + TanStack Query |
| `/debates/[id]/transcript` | `src/app/debates/[id]/transcript/page.tsx` | Server Component — fetches `GET /debates/{id}/transcript.md` at request time, renders via `react-markdown` |

No auth. No user accounts. A debate ID is the only handle to a debate.

## Data flow

1. `/` — `<ClaimInput />` calls `POST /debates` via TanStack Query mutation → redirects (`router.push`) to `/debates/{debate_id}` on success.
2. `/debates/[id]` — on mount, opens SSE to `${NEXT_PUBLIC_API_URL}/debates/{id}/stream`. On every `state` event whose `rounds_count` increased OR whose `status` changed, the page re-fetches `GET /debates/{id}` via TanStack Query (`queryClient.invalidateQueries`). On `done`, closes the SSE and shows "View transcript" CTA.
3. `/debates/[id]/transcript` — server-side fetches the markdown endpoint; 404 → `notFound()`; success → renders.

## Invariants

- Route params are parsed with zod (`uuid` schema). Invalid UUID → `notFound()`.
- No route requires auth headers. All errors surface as either a `notFound()` route or a toast on the live page.
- `/debates/[id]` must be deep-linkable — refreshing the page reconstructs state from `GET /debates/{id}` even if the SSE has already emitted `done`.

## Test cases (S3 red tests)

### Pass cases

- **P1** `/` renders without throwing and shows a `<ClaimInput>` with an accessible textbox labeled "claim".
- **P2** `/` — submitting a valid claim calls the `POST /debates` mutation with `{ claim, max_rounds: 5 }` and on success pushes to `/debates/{returned id}`.
- **P3** `/debates/[id]` — given a valid UUID and a mocked `GET /debates/{id}` returning `status: "running"`, renders the two-panel arena with a skeleton evidence area and a "connecting" badge.
- **P4** `/debates/[id]` — when the SSE reports `done` with `status: "done"` and `verdict: "TRUE"`, a `<JudgeVerdict>` appears and a "View transcript" link points at `/debates/{id}/transcript`.
- **P5** `/debates/[id]/transcript` — given a mocked markdown response, renders the markdown body inside a `<TranscriptView>` with headings correctly hierarchized.

### Failure cases (negative space)

- **F1** `/debates/[id]` — param is `"not-a-uuid"` → renders the Next.js `not-found` UI; no network request is made.
- **F2** `/debates/[id]` — `GET /debates/{id}` returns `404` → page shows an error state with a "Go home" link, NOT a silent empty page.
- **F3** `/debates/[id]` — `POST /debates` on the home page errors (500) → `<ClaimInput>` surfaces a toast *and* restores the user's typed claim in the input (no data loss).
- **F4** `/debates/[id]/transcript` — backend returns 404 → `notFound()` (Next.js 404 page), not a blank transcript.
- **F5** `/debates/[id]/transcript` — backend returns `200` with empty body → page renders an empty-state message, not a broken markdown shell.
- **F6** `/` — submitting an empty claim is blocked client-side; `POST` is never issued.
- **F7** `/` — submitting a claim >2000 chars is blocked client-side with an inline error matching the backend validation.
