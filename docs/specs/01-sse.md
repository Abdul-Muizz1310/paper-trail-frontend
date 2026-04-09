# Spec 01 — SSE consumer

## Scope

A client-side hook, `useDebateStream(debateId)`, that opens an `EventSource` against `${NEXT_PUBLIC_API_URL}/debates/{id}/stream`, ingests typed events, reconnects on disconnect, and exposes a discriminated-union status to React.

Lives in [`src/lib/sse.ts`](../../src/lib/sse.ts).

## Backend contract (frozen by `paper-trail-backend` v0.1.0)

The backend emits three named SSE events. Every `data` field is JSON.

| Event name | Payload shape | When |
|---|---|---|
| `state` | `{ type: "state", status: string, verdict: "TRUE"\|"FALSE"\|"INCONCLUSIVE"\|null, confidence: number\|null, rounds_count: number }` | Every poll where the tuple `(status, verdict, confidence, rounds_count)` changed |
| `done` | `{ type: "done", status?: string, verdict?: ..., confidence?: ..., rounds_count?: number, reason?: "timeout" }` | When `status ∈ {"done","failed","error"}` or the 60s server-side deadline elapses |
| `error` | `{ reason: "not_found" }` | Debate ID does not exist |

**Critical:** the stream does NOT carry per-round agent content. On each `state` whose `rounds_count` or `status` changed, the consumer MUST trigger a refetch of `GET /debates/{id}` to pull the full `rounds[]` snapshot.

## Hook API

```ts
type StreamPhase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "streaming"; lastState: StateEvent }
  | { kind: "done"; final: DoneEvent }
  | { kind: "error"; reason: "not_found" | "network" | "max_retries_exceeded" };

function useDebateStream(debateId: string, opts?: {
  maxRetries?: number;       // default 5
  backoffMs?: (attempt: number) => number; // default: 500 * 2^attempt, capped at 8000
  onStateChange?: (ev: StateEvent) => void; // fired on every `state` event
}): { phase: StreamPhase; close: () => void };
```

- `phase` transitions are monotonic except `streaming → connecting` on disconnect (during retry).
- On `done` or terminal `error`, the underlying `EventSource` is closed and not reopened.
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
