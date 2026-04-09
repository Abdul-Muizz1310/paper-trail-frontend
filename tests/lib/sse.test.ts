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
});
