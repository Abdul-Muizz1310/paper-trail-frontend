import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackendStatus } from "@/components/BackendStatus";

/* ---------------------------------------------------------------
 * Mock fetch globally; each test configures its own behaviour.
 * --------------------------------------------------------------- */

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe("BackendStatus", () => {
  it("P1 renders 'pinging backend…' initially (checking state)", () => {
    // Never-resolving fetch keeps us in 'checking'
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}));
    render(<BackendStatus />);
    expect(screen.getByText(/pinging backend/)).toBeInTheDocument();
  });

  it("P2 shows warm + latency on fast 200 response", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
    render(<BackendStatus />);
    // Let the microtask queue flush the .then()
    await act(() => Promise.resolve());
    expect(screen.getByText("OK")).toBeInTheDocument();
    // latency is rendered as a number + "ms"
    expect(screen.getByText(/\d+ms/)).toBeInTheDocument();
  });

  it("P3 shows cold when response takes longer than 3s", async () => {
    // Fetch that never resolves — the cold timer fires at 3s
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}));
    render(<BackendStatus />);
    // Advance past the cold threshold
    await act(async () => {
      vi.advanceTimersByTime(3_100);
    });
    expect(screen.getByText(/waking up/)).toBeInTheDocument();
  });

  it("P4 shows down when fetch rejects", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("network")));
    render(<BackendStatus />);
    await act(() => Promise.resolve());
    expect(screen.getByText(/unreachable/)).toBeInTheDocument();
  });

  it("P5 shows down when response is not ok (e.g. 500)", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("", { status: 500 })));
    render(<BackendStatus />);
    await act(() => Promise.resolve());
    expect(screen.getByText(/unreachable/)).toBeInTheDocument();
  });

  it("F1 cold timer is cleared when fast response arrives", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
    render(<BackendStatus />);
    await act(() => Promise.resolve());
    // After warm is set, advancing past 3s should NOT show cold
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.queryByText(/waking up/)).toBeNull();
  });

  it("F2 cold timer no-ops if status already moved past checking (warm)", async () => {
    // Fetch resolves fast (→ 'warm' + clearTimeout), then advance past cold threshold
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
    render(<BackendStatus />);
    await act(() => Promise.resolve());
    expect(screen.getByText("OK")).toBeInTheDocument();
    // Advance past cold threshold — cold timer was cleared, status stays warm
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.queryByText(/waking up/)).toBeNull();
  });

  it("F2b cold timer no-ops if status already moved to down", async () => {
    // Fetch rejects immediately (→ 'down'), then cold timer fires — status stays 'down'
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("network")));
    render(<BackendStatus />);
    await act(() => Promise.resolve());
    expect(screen.getByText(/unreachable/)).toBeInTheDocument();
    // Now advance past cold threshold — cold timer still fires, but setState is no-op
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByText(/unreachable/)).toBeInTheDocument();
    expect(screen.queryByText(/waking up/)).toBeNull();
  });

  it("F3 abort controller cancels fetch on unmount", () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}));
    const { unmount } = render(<BackendStatus />);
    unmount();
    expect(abortSpy).toHaveBeenCalled();
    abortSpy.mockRestore();
  });
});
