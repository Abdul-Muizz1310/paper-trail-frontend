"use client";

import { useEffect, useRef, useState } from "react";
import { env } from "@/lib/env";
import {
  type DoneEvent,
  DoneEventSchema,
  ErrorEventSchema,
  type StateEvent,
  StateEventSchema,
  type ErrorEvent as TrailErrorEvent,
} from "@/lib/schemas";

export type StreamPhase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "streaming"; lastState: StateEvent }
  | { kind: "done"; final: DoneEvent }
  | {
      kind: "error";
      reason: "not_found" | "network" | "max_retries_exceeded";
    };

export type UseDebateStreamOptions = {
  maxRetries?: number;
  backoffMs?: (attempt: number) => number;
  onStateChange?: (ev: StateEvent) => void;
};

const DEFAULT_BACKOFF = (attempt: number) => Math.min(500 * 2 ** attempt, 8_000);

function parseJson(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

/**
 * Subscribe to a debate's SSE stream. Lifecycle:
 *
 *   idle → connecting → streaming → (done | error)
 *                     ↘ connecting (transient errors, capped retries)
 *
 * The hook handles its own reconnect schedule, closes the EventSource on
 * unmount, and drops unknown / malformed events without crashing.
 */
export function useDebateStream(
  debateId: string,
  opts: UseDebateStreamOptions = {},
): { phase: StreamPhase; close: () => void } {
  const { maxRetries = 5, backoffMs = DEFAULT_BACKOFF, onStateChange } = opts;

  const [phase, setPhase] = useState<StreamPhase>({ kind: "connecting" });
  const esRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const terminatedRef = useRef(false);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    terminatedRef.current = false;
    attemptRef.current = 0;
    setPhase({ kind: "connecting" });

    const clearRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const teardown = () => {
      clearRetry();
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };

    const terminate = (next: StreamPhase) => {
      terminatedRef.current = true;
      teardown();
      setPhase(next);
    };

    const connect = () => {
      if (terminatedRef.current) return;
      const url = `${env.NEXT_PUBLIC_API_URL}/debates/${debateId}/stream`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("open", () => {
        // Successful open resets the retry counter so a later disconnect
        // gets a full retry budget.
        attemptRef.current = 0;
      });

      es.addEventListener("state", (ev) => {
        if (terminatedRef.current) return;
        const raw = parseJson((ev as MessageEvent).data);
        if (raw === undefined) return;
        const parsed = StateEventSchema.safeParse(raw);
        if (!parsed.success) return;
        onStateChangeRef.current?.(parsed.data);
        setPhase({ kind: "streaming", lastState: parsed.data });
      });

      es.addEventListener("done", (ev) => {
        if (terminatedRef.current) return;
        const raw = parseJson((ev as MessageEvent).data);
        const parsed = DoneEventSchema.safeParse(raw);
        const final: DoneEvent = parsed.success ? parsed.data : { type: "done" };
        terminate({ kind: "done", final });
      });

      // Named "error" event from the server (payload {reason: "..."}).
      es.addEventListener("error", (ev) => {
        if (terminatedRef.current) return;

        // Two error paths share this listener:
        //   (a) server-sent `event: error` carrying JSON in data
        //   (b) transport-level error (no data) → reconnect
        const maybeData = (ev as MessageEvent).data;
        if (typeof maybeData === "string" && maybeData.length > 0) {
          const raw = parseJson(maybeData);
          const parsed = ErrorEventSchema.safeParse(raw);
          if (parsed.success) {
            const reason: TrailErrorEvent["reason"] = parsed.data.reason;
            if (reason === "not_found") {
              terminate({ kind: "error", reason: "not_found" });
              return;
            }
          }
        }

        // Transport-level error → teardown current ES and reconnect.
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }

        if (attemptRef.current >= maxRetries) {
          terminate({ kind: "error", reason: "max_retries_exceeded" });
          return;
        }
        const delay = backoffMs(attemptRef.current);
        attemptRef.current += 1;
        setPhase({ kind: "connecting" });
        retryTimerRef.current = setTimeout(connect, delay);
      });
    };

    connect();

    return () => {
      terminatedRef.current = true;
      teardown();
    };
  }, [debateId, maxRetries, backoffMs]);

  const close = () => {
    terminatedRef.current = true;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  };

  return { phase, close };
}
