import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DebateView } from "@/app/debates/[id]/DebateView";
import type { Debate, StateEvent } from "@/lib/schemas";
import type { StreamPhase, UseDebateStreamOptions } from "@/lib/sse";

/* ---------------------------------------------------------------
 * DebateView is the SSE + TanStack Query orchestrator. We mock its
 * three collaborators so we can drive the wiring directly and assert
 * that it no longer refetches the backend on every SSE tick.
 * --------------------------------------------------------------- */

const DEBATE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

let streamPhase: StreamPhase;
let capturedOnStateChange: ((ev: StateEvent) => void) | undefined;
const invalidateSpy = vi.fn();
const patchSpy = vi.fn();
let debateQuery: { data?: Debate; isPending: boolean; isError: boolean };

vi.mock("@/lib/sse", () => ({
  useDebateStream: (_id: string, opts: UseDebateStreamOptions) => {
    capturedOnStateChange = opts?.onStateChange;
    return { phase: streamPhase, close: vi.fn() };
  },
}));

vi.mock("@/lib/api", () => ({
  useDebate: () => debateQuery,
  useInvalidateDebate: () => invalidateSpy,
  usePatchDebate: () => patchSpy,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const baseDebate: Debate = {
  id: DEBATE_ID,
  claim: "Is the sky blue?",
  status: "running",
  verdict: null,
  confidence: null,
  rounds: [],
  transcript_md: null,
  created_at: "2026-04-10T00:00:00Z",
};

function stateEvent(roundsCount: number, withRounds: boolean): StateEvent {
  return {
    type: "state",
    status: "running",
    verdict: null,
    confidence: null,
    rounds_count: roundsCount,
    ...(withRounds
      ? { rounds: [{ side: "pro", round: roundsCount, argument: "arg", evidence: [] }] }
      : {}),
  };
}

beforeEach(() => {
  streamPhase = { kind: "connecting" };
  debateQuery = { data: baseDebate, isPending: false, isError: false };
  capturedOnStateChange = undefined;
  invalidateSpy.mockClear();
  patchSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DebateView — SSE cache wiring", () => {
  it("P1 patches the cache on every state event but does NOT invalidate when rounds are inlined", () => {
    render(<DebateView debateId={DEBATE_ID} />);
    act(() => {
      capturedOnStateChange?.(stateEvent(1, true));
      capturedOnStateChange?.(stateEvent(2, true));
      capturedOnStateChange?.(stateEvent(3, true));
    });
    // Cache patched in place for each event...
    expect(patchSpy).toHaveBeenCalledTimes(3);
    // ...and NO backend refetch was triggered (the "no-refetch" design).
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("P2 legacy backend (no inlined rounds) triggers a THROTTLED refetch, not one per event", () => {
    render(<DebateView debateId={DEBATE_ID} />);
    act(() => {
      capturedOnStateChange?.(stateEvent(1, false));
      capturedOnStateChange?.(stateEvent(2, false));
      capturedOnStateChange?.(stateEvent(3, false));
    });
    // Three rapid state events → at most one refetch inside the throttle window.
    expect(patchSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it("P3 invalidates exactly once on the terminal 'done' phase (to pull transcript_md)", () => {
    streamPhase = { kind: "done", final: { type: "done" } };
    render(<DebateView debateId={DEBATE_ID} />);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it("P4 safety-net poll runs ONLY for legacy backends (no inlined rounds)", () => {
    vi.useFakeTimers();
    streamPhase = { kind: "streaming", lastState: stateEvent(1, false) };
    render(<DebateView debateId={DEBATE_ID} />);
    invalidateSpy.mockClear();
    act(() => {
      vi.advanceTimersByTime(3_100);
    });
    // No inlined rounds were ever seen → the poll is active and refetches.
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("P5 safety-net poll is disabled once inlined rounds are observed", () => {
    vi.useFakeTimers();
    streamPhase = { kind: "connecting" };
    const { rerender } = render(<DebateView debateId={DEBATE_ID} />);
    // Observe an inlined-rounds state event → poll must switch off.
    act(() => {
      capturedOnStateChange?.(stateEvent(1, true));
    });
    streamPhase = { kind: "streaming", lastState: stateEvent(1, true) };
    rerender(<DebateView debateId={DEBATE_ID} />);
    invalidateSpy.mockClear();
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("DebateView — terminal rendering", () => {
  it("P6 renders the verdict and a transcript link when done", () => {
    streamPhase = { kind: "done", final: { type: "done" } };
    debateQuery = {
      data: {
        ...baseDebate,
        status: "done",
        verdict: "TRUE",
        confidence: 0.82,
        transcript_md: "## Reasoning\n\nBecause the evidence favours it.",
      },
      isPending: false,
      isError: false,
    };
    render(<DebateView debateId={DEBATE_ID} />);
    expect(screen.getByTestId("judge-verdict")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /transcript/i });
    expect(link).toHaveAttribute("href", `/debates/${DEBATE_ID}/transcript`);
  });

  it("P7 renders an error + go-home link when the debate query fails", () => {
    streamPhase = { kind: "error", reason: "not_found" };
    debateQuery = { data: undefined, isPending: false, isError: true };
    render(<DebateView debateId={DEBATE_ID} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t load this debate/i);
    expect(screen.getByRole("link", { name: /go home/i })).toBeInTheDocument();
  });
});
