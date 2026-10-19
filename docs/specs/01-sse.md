# Spec 01 — SSE consumer

## Scope

A client-side hook, `useDebateStream(debateId)`, that opens an `EventSource` against `/api/backend/debates/{id}/stream` (the same-origin signing proxy of [spec 05](05-backend-proxy.md); `EventSource` cannot send the backend's token header itself), ingests typed events, reconnects on disconnect, and exposes a discriminated-union status to React.

Lives in [`src/lib/sse.ts`](../../src/lib/sse.ts).

## Backend contract (frozen by `paper-trail-backend` v0.1.0)

The backend emits three named SSE events. Every `data` field is JSON.

| Event name | Payload shape | When |
|---|---|---|
| `state` | `{ type: "state", status: string, verdict: "TRUE"\|"FALSE"\|"INCONCLUSIVE"\|null, confidence: number\|null, rounds_count: number }` | Every poll where the tuple `(status, verdict, confidence, rounds_count)` changed |
| `done` | `{ type: "done", status?: string, verdict?: ..., confidence?: ..., rounds_count?: number, reason?: "timeout" }` | When `status ∈ {"done","failed","error"}`, or — as `{ type: "done", reason: "timeout" }` with no `status` — when the backend's 120 s per-connection cap (`STREAM_MAX_SECONDS`) elapses while the debate is still running |
| `error` | `{ reason: "not_found" \| "gone" \| ... }` | Terminal reasons (`not_found`, `gone`) stop retries and are preserved on the phase; other reasons trigger a reconnect |

**Round content.** As of backend v0.1.1 the `state` event inlines the full `rounds[]` array, so the consumer patches the TanStack Query cache in place from the payload and does **not** refetch during streaming (the "no-refetch" design). Two exceptions:

- On the terminal `done` phase the consumer refetches `GET /debates/{id}` **once** to pull `transcript_md`, which `state` events don't carry.
- For legacy backends that omit inline `rounds[]`, the consumer falls back to a **throttled** refetch (≤ once per 3s) plus a 3s safety-net poll — active only until the first inline-rounds event is seen. It must never fire a `GET` on every `state` tick.

**A stream cut is not the end of the debate.** The backend closes every stream after 120 s with
`{ type: "done", reason: "timeout" }` and no `status`, whether or not the debate has finished. A
debate on the free models routinely runs longer than that (each round is three LLM calls, and the
backend's own run deadline is 300 s). Treating that event as terminal froze the page: the phase went
to `done`, the one refetch still saw `status: "running"`, and the verdict never rendered until a
manual reload. So the hook *renews* the stream on a cut: it closes the old `EventSource` and opens a
new one on the same URL straight away, in phase `connecting`. Only a `done` that is not a cut is
terminal. Renewals are capped (`maxRenewals`, default 5, i.e. at least 10 minutes of streaming);
past the cap the hook stops with `{ kind: "error", reason: "max_retries_exceeded" }`, so a debate
that never finishes cannot keep a tab reconnecting forever. Renewals do not spend the transport
retry budget (`maxRetries`), which is for failures.

## Hook API

```ts
type StreamPhase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "streaming"; lastState: StateEvent }
  | { kind: "done"; final: DoneEvent }
  | { kind: "error"; reason: "not_found" | "gone" | "network" | "max_retries_exceeded" };

function useDebateStream(debateId: string, opts?: {
  maxRetries?: number;       // default 5
  maxRenewals?: number;      // default 5: stream cuts (done + reason "timeout") renewed before giving up
  backoffMs?: (attempt: number) => number; // default: 500 * 2^attempt, capped at 8000
  onStateChange?: (ev: StateEvent) => void; // fired on every `state` event
}): { phase: StreamPhase; close: () => void };
```

- `phase` transitions are monotonic except `streaming → connecting` on disconnect (during retry).
- On a terminal `done` (any `done` that is not a stream cut) or a terminal `error`, the underlying `EventSource` is closed and not reopened. On a stream cut it is closed and a new one is opened on the same URL.
- Unmounting the hook closes the `EventSource`.

## Invariants

- Unknown event types are logged and dropped — never crash, never put the hook in an invalid phase.
- `state` payloads are parsed through a zod schema; parse failure is logged and the event is dropped (NOT elevated to `error`).
- Reconnect schedule: up to `maxRetries` times with exponential backoff. After the last failure, transition to `{ kind: "error", reason: "max_retries_exceeded" }` and stop.
- The hook never races with itself: closing during a pending retry cancels the scheduled reconnect.

## Test cases (S3 red tests)

Tests live in `tests/lib/sse.test.ts` using a handwritten `FakeEventSource` installed on `globalThis.EventSource` in the vitest setup.

### Pass cases

- **P1** Opening the stream transitions `idle → connecting → streaming` after the first `state` event.
- **P2** Events are delivered to `onStateChange` in the order the server emitted them.
- **P3** Receiving a `done` event transitions to `{ kind: "done", final }` and closes the `EventSource`.
- **P4** Receiving a `state` whose `rounds_count` equals the previous one does NOT call `onStateChange` *unless* a non-`rounds_count` field also changed (dedupe is backend-side, but the hook must still forward whatever the backend sends — this test asserts the hook does not add its own dedupe).
- **P5** Calling `close()` transitions to `done`-but-terminated (or leaves `phase` as-is if already terminal) and cancels any pending retry timer.
- **P6** On a synthetic `error` DOM event, the hook tears down the current `EventSource`, schedules a reconnect per backoff, and on the next successful open returns to `streaming`.

### Failure cases (negative space)

- **F1** Receiving an SSE `error` event with `{ reason: "not_found" }` transitions to `{ kind: "error", reason: "not_found" }` and does NOT retry.
- **F2** Exhausting `maxRetries` consecutive reconnect attempts transitions to `{ kind: "error", reason: "max_retries_exceeded" }` and stops.
- **F3** A `state` event whose `data` is not valid JSON is dropped; `phase` and `onStateChange` are unaffected.
- **F4** A `state` event whose payload fails the zod schema (e.g. `confidence: "high"` instead of number) is dropped; no crash.
- **F5** An unknown event name (e.g. `progress`) is ignored; `phase` unchanged.
- **F6** Unmounting the React component while the hook is in `connecting` cancels the reconnect timer (verified by `vi.useFakeTimers` + advancing time past the scheduled backoff — no `EventSource` is created after unmount).
- **F7** `debateId` changing mid-flight closes the old `EventSource` before opening a new one (no leak).

### Stream cuts (2026-10-20)

- **P7** A `done` event with `reason: "timeout"` and no `status` closes the current `EventSource`,
  opens a new one on the same proxy URL, and leaves the phase `connecting`, not `done`.
- **P8** After a renewal, `state` events on the new stream reach `onStateChange` and a real `done`
  (with `status`) is terminal as usual.
- **F13** A stream cut past `maxRenewals` transitions to `{ kind: "error", reason:
  "max_retries_exceeded" }` and opens no further `EventSource`.
- **F14** A `done` that carries a `status` is terminal even if it also says `reason: "timeout"`.
- **F15** Renewals do not spend the transport retry budget: after `maxRetries` cuts, a transport
  error still schedules a reconnect instead of giving up.

