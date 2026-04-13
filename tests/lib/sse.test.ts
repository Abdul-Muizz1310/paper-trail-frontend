import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebateStream } from "@/lib/sse";
import { FakeEventSource } from "./fake-event-source";

const DEBATE_ID = "11111111-1111-1111-1111-111111111111";
const API_URL = "https://paper-trail-backend-7h27.onrender.com";

beforeEach(() => {
  FakeEventSource.reset();
  // @ts-expect-error install fake
  globalThis.EventSource = FakeEventSource;
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("useDebateStream — pass cases", () => {
  it("P1 transitions idle → connecting → streaming on first state event", async () => {
    const { result } = renderHook(() => useDebateStream(DEBATE_ID));
    expect(result.current.phase.kind).toBe("connecting");

    act(() => {
      FakeEventSource.last().openNow();
      FakeEventSource.last().emit("state", {
        type: "state",
        status: "running",
        verdict: null,
        confidence: null,
        rounds_count: 0,
      });
    });

    await waitFor(() => expect(result.current.phase.kind).toBe("streaming"));
  });

  it("P2 delivers state events in order via onStateChange", async () => {
    const onStateChange = vi.fn();
    renderHook(() => useDebateStream(DEBATE_ID, { onStateChange }));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      es.emit("state", {
        type: "state",
        status: "running",
        verdict: null,
        confidence: null,
        rounds_count: 1,
      });
      es.emit("state", {
        type: "state",
        status: "running",
        verdict: null,
        confidence: null,
        rounds_count: 2,
      });
    });
    await waitFor(() => expect(onStateChange).toHaveBeenCalledTimes(2));
    expect(onStateChange.mock.calls[0][0].rounds_count).toBe(1);
    expect(onStateChange.mock.calls[1][0].rounds_count).toBe(2);
  });

  it("P3 done event transitions to done and closes the EventSource", async () => {
    const { result } = renderHook(() => useDebateStream(DEBATE_ID));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      es.emit("done", {
        type: "done",
        status: "done",
        verdict: "TRUE",
        confidence: 0.9,
        rounds_count: 4,
      });
    });
    await waitFor(() => expect(result.current.phase.kind).toBe("done"));
    expect(es.readyState).toBe(2);
  });

  it("P5 close() stops the hook and cancels pending retries", async () => {
    const { result } = renderHook(() => useDebateStream(DEBATE_ID));
    act(() => FakeEventSource.last().openNow());
    act(() => result.current.close());
    expect(FakeEventSource.last().readyState).toBe(2);
  });

  it("P6 reconnects on transient error and returns to streaming", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { maxRetries: 3 }));
    act(() => {
      FakeEventSource.last().openNow();
      FakeEventSource.last().emit("state", {
        type: "state",
        status: "running",
        verdict: null,
        confidence: null,
        rounds_count: 1,
      });
    });
    expect(result.current.phase.kind).toBe("streaming");

    act(() => FakeEventSource.last().fail());
    expect(result.current.phase.kind).toBe("connecting");

    // Advance past the first backoff (500ms default for attempt 0).
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      FakeEventSource.last().openNow();
      FakeEventSource.last().emit("state", {
        type: "state",
        status: "running",
        verdict: null,
        confidence: null,
        rounds_count: 2,
      });
    });
    expect(result.current.phase.kind).toBe("streaming");
    expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2);
  });
});

describe("useDebateStream — failure cases (negative space)", () => {
  it("F1 error event with reason:not_found → terminal, no retry", async () => {
    const { result } = renderHook(() => useDebateStream(DEBATE_ID));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      es.emit("error", { reason: "not_found" });
    });
    await waitFor(() => {
      expect(result.current.phase.kind).toBe("error");
      if (result.current.phase.kind === "error") {
        expect(result.current.phase.reason).toBe("not_found");
      }
    });
    expect(FakeEventSource.instances.length).toBe(1);
  });

  it("F2 exhausts maxRetries then errors with max_retries_exceeded", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { maxRetries: 2 }));

    for (let i = 0; i < 3; i++) {
      act(() => FakeEventSource.last().fail());
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
    }
    expect(result.current.phase.kind).toBe("error");
    if (result.current.phase.kind === "error") {
      expect(result.current.phase.reason).toBe("max_retries_exceeded");
    }
  });

  it("F3 malformed JSON state event is dropped", async () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { onStateChange }));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      // Emit a raw string that is not JSON.
      es.emit("state", "not-json-at-all{");
    });
    expect(onStateChange).not.toHaveBeenCalled();
    expect(result.current.phase.kind).not.toBe("error");
  });

  it("F4 payload failing zod schema is dropped", async () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { onStateChange }));
    act(() => FakeEventSource.last().openNow());
    act(() =>
      FakeEventSource.last().emit("state", {
        type: "state",
        status: "running",
        verdict: "MAYBE", // invalid
        confidence: "high", // invalid
        rounds_count: 1,
      }),
    );
    expect(onStateChange).not.toHaveBeenCalled();
    expect(result.current.phase.kind).not.toBe("error");
  });

  it("F5 unknown event name is ignored", async () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { onStateChange }));
    act(() => {
      FakeEventSource.last().openNow();
      FakeEventSource.last().emit("progress", { whatever: true });
    });
    expect(onStateChange).not.toHaveBeenCalled();
    expect(result.current.phase.kind).not.toBe("error");
  });

  it("F6 unmount during connecting cancels pending reconnect", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useDebateStream(DEBATE_ID));
    act(() => FakeEventSource.last().fail());
    const before = FakeEventSource.instances.length;
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(FakeEventSource.instances.length).toBe(before);
  });

  it("F7 changing debateId closes the old EventSource", async () => {
    const { rerender } = renderHook(({ id }: { id: string }) => useDebateStream(id), {
      initialProps: { id: DEBATE_ID },
    });
    const first = FakeEventSource.last();
    act(() => first.openNow());
    rerender({ id: "22222222-2222-2222-2222-222222222222" });
    expect(first.readyState).toBe(2);
    expect(FakeEventSource.instances.length).toBe(2);
  });

  it("F8 connect timeout fires when EventSource never opens", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useDebateStream(DEBATE_ID, { maxRetries: 0, connectTimeoutMs: 1_000 }),
    );
    expect(result.current.phase.kind).toBe("connecting");

    // Don't call openNow() — simulate hanging connection
    act(() => {
      vi.advanceTimersByTime(1_100);
    });

    // After timeout + 0 retries, should error
    expect(result.current.phase.kind).toBe("error");
    if (result.current.phase.kind === "error") {
      expect(result.current.phase.reason).toBe("max_retries_exceeded");
    }
  });

  it("F9 connect timeout is cleared when EventSource opens in time", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { connectTimeoutMs: 2_000 }));

    // Open before timeout
    act(() => {
      vi.advanceTimersByTime(500);
      FakeEventSource.last().openNow();
    });

    // Advance past the timeout threshold — should NOT disconnect
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current.phase.kind).not.toBe("error");
  });

  it("F10 close() cancels pending retry timer during reconnect backoff", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { maxRetries: 3 }));
    // Trigger a transport error to start a retry backoff
    act(() => {
      FakeEventSource.last().openNow();
      FakeEventSource.last().fail();
    });
    expect(result.current.phase.kind).toBe("connecting");
    // Now call close() while the retry timer is pending
    act(() => result.current.close());
    // Advancing time should NOT create a new EventSource
    const countBefore = FakeEventSource.instances.length;
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(FakeEventSource.instances.length).toBe(countBefore);
  });

  it("F11 transport error exhausting maxRetries triggers max_retries_exceeded", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { maxRetries: 1 }));
    // First connection — fail without opening (don't reset attempt counter)
    act(() => {
      FakeEventSource.last().fail();
    });
    expect(result.current.phase.kind).toBe("connecting");
    // Advance past backoff to trigger retry
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    // Second connection — fail again to exhaust retries (attempt 1 >= maxRetries 1)
    act(() => {
      FakeEventSource.last().fail();
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.phase.kind).toBe("error");
    if (result.current.phase.kind === "error") {
      expect(result.current.phase.reason).toBe("max_retries_exceeded");
    }
  });

  it("F11a connect after terminated is a no-op", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useDebateStream(DEBATE_ID, { maxRetries: 3 }));
    // Unmount sets terminatedRef = true
    unmount();
    const countBefore = FakeEventSource.instances.length;
    // Advance timers — no new connections should be made
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(FakeEventSource.instances.length).toBe(countBefore);
  });

  it("F11b state event after done is ignored (terminatedRef)", async () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { onStateChange }));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      es.emit("done", { type: "done" });
    });
    await waitFor(() => expect(result.current.phase.kind).toBe("done"));
    onStateChange.mockClear();
    // Now emit a state event on the same ES (after termination)
    act(() => {
      es.emit("state", {
        type: "state",
        status: "running",
        verdict: null,
        confidence: null,
        rounds_count: 5,
      });
    });
    expect(onStateChange).not.toHaveBeenCalled();
    expect(result.current.phase.kind).toBe("done");
  });

  it("F11c done event after done is ignored (terminatedRef)", async () => {
    const { result } = renderHook(() => useDebateStream(DEBATE_ID));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      es.emit("done", { type: "done", verdict: "TRUE", confidence: 0.9 });
    });
    await waitFor(() => expect(result.current.phase.kind).toBe("done"));
    // Emit another done — should be ignored
    act(() => {
      es.emit("done", { type: "done", verdict: "FALSE", confidence: 0.1 });
    });
    if (result.current.phase.kind === "done") {
      expect(result.current.phase.final.verdict).toBe("TRUE");
    }
  });

  it("F11d error event after done is ignored (terminatedRef)", async () => {
    const { result } = renderHook(() => useDebateStream(DEBATE_ID));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      es.emit("done", { type: "done" });
    });
    await waitFor(() => expect(result.current.phase.kind).toBe("done"));
    // Emit error event — should be ignored
    act(() => {
      es.emit("error", { reason: "not_found" });
    });
    expect(result.current.phase.kind).toBe("done");
  });

  it("F12_done malformed done event still transitions to done with fallback", async () => {
    const { result } = renderHook(() => useDebateStream(DEBATE_ID));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      // Emit a done event with invalid JSON — parseDone fails, fallback to { type: "done" }
      es.emit("done", "not-valid-json{{{");
    });
    await waitFor(() => expect(result.current.phase.kind).toBe("done"));
    if (result.current.phase.kind === "done") {
      expect(result.current.phase.final.type).toBe("done");
    }
  });

  it("F12_err error event with non-terminal reason triggers reconnect", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { maxRetries: 3 }));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      // Server-sent error with a non-terminal reason
      es.emit("error", { reason: "throttled" });
    });
    // Should reconnect, not terminate
    expect(result.current.phase.kind).toBe("connecting");
    // Advance timers to trigger reconnect
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(FakeEventSource.instances.length).toBeGreaterThan(1);
  });

  it("F12_state_undefined state event with undefined data is dropped", async () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { onStateChange }));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      // Emit a state event that will have undefined as data (no JSON.stringify)
      const ev = new MessageEvent("state", { data: undefined as unknown as string });
      es["listeners"].get("state")?.forEach((l: (ev: Event) => void) => l(ev));
    });
    expect(onStateChange).not.toHaveBeenCalled();
    expect(result.current.phase.kind).not.toBe("error");
  });

  it("F12_err2 error event with invalid JSON in data reconnects", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { maxRetries: 3 }));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      // Emit error event with non-JSON data string
      es.emit("error", "this is not json{");
    });
    // Should trigger reconnect since it can't parse the error payload
    expect(result.current.phase.kind).toBe("connecting");
  });

  it("F12_err3 error event with parseable JSON but no reason field reconnects", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { maxRetries: 3 }));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      // Error event with valid JSON but missing required 'reason' field
      es.emit("error", { missing: "reason" });
    });
    expect(result.current.phase.kind).toBe("connecting");
  });

  it("F12a FakeEventSource.removeEventListener removes a listener", () => {
    const es = new FakeEventSource(`${API_URL}/test`);
    const listener = vi.fn();
    es.addEventListener("test", listener);
    es.emit("test", { data: "x" });
    expect(listener).toHaveBeenCalledOnce();
    listener.mockClear();
    es.removeEventListener("test", listener);
    es.emit("test", { data: "y" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("F12b_esNull error on already-closed ES (esRef null) reconnects cleanly", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebateStream(DEBATE_ID, { maxRetries: 3 }));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
    });
    // Manually close the esRef by triggering a previous error
    act(() => {
      es.fail();
    });
    // The fail() should have set esRef to null and scheduled retry
    expect(result.current.phase.kind).toBe("connecting");
  });

  it("F12c error event with reason:gone is also terminal (via isTerminalErrorReason)", async () => {
    const { result } = renderHook(() => useDebateStream(DEBATE_ID));
    const es = FakeEventSource.last();
    act(() => {
      es.openNow();
      es.emit("error", { reason: "gone" });
    });
    await waitFor(() => {
      expect(result.current.phase.kind).toBe("error");
      if (result.current.phase.kind === "error") {
        expect(result.current.phase.reason).toBe("not_found");
      }
    });
    // Terminal — no retry
    expect(FakeEventSource.instances.length).toBe(1);
  });
});
