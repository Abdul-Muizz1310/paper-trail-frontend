import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  debateKey,
  useCreateDebate,
  useDebate,
  useInvalidateDebate,
  usePatchDebate,
} from "@/lib/api";
import type { Debate } from "@/lib/schemas";

/* ---------------------------------------------------------------
 * Fetch mock
 * --------------------------------------------------------------- */

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchOk(body: unknown) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

function mockFetchError(status: number) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response("", { status }));
}

/* ---------------------------------------------------------------
 * QueryClient wrapper
 * --------------------------------------------------------------- */

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

/* ---------------------------------------------------------------
 * debateKey
 * --------------------------------------------------------------- */

describe("debateKey", () => {
  it("returns a stable key tuple", () => {
    expect(debateKey("abc")).toEqual(["debate", "abc"]);
  });
});

/* ---------------------------------------------------------------
 * ApiError
 * --------------------------------------------------------------- */

describe("ApiError", () => {
  it("P1 stores status and message", () => {
    const err = new ApiError(404, "not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("not found");
    expect(err.name).toBe("ApiError");
  });
});

/* ---------------------------------------------------------------
 * useDebate
 * --------------------------------------------------------------- */

const DEBATE_RESPONSE = {
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  claim: "The sky is blue",
  status: "done",
  verdict: "TRUE",
  confidence: 0.9,
  rounds: [
    {
      side: "proponent",
      round: 1,
      argument: "yes",
      evidence: [{ title: "NASA", url: "https://nasa.gov", snippet: "s" }],
    },
  ],
  transcript_md: "# T",
  created_at: "2026-04-10T00:00:00Z",
};

describe("useDebate", () => {
  it("P1 fetches and parses a debate via Zod", async () => {
    mockFetchOk(DEBATE_RESPONSE);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDebate("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.claim).toBe("The sky is blue");
    // rounds should be parsed through parseRounds
    expect(data?.rounds[0].side).toBe("pro");
    expect(data?.rounds[0].body_md).toBe("yes");
  });

  it("F1 throws ApiError on non-200 status", async () => {
    mockFetchError(500);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDebate("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it("P2 disabled when enabled=false", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDebate("abc", false), { wrapper });
    // Should not be fetching
    expect(result.current.fetchStatus).toBe("idle");
  });
});

/* ---------------------------------------------------------------
 * useCreateDebate
 * --------------------------------------------------------------- */

describe("useCreateDebate", () => {
  it("P1 posts and parses create response via Zod", async () => {
    mockFetchOk({
      debate_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      stream_url: "/debates/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/stream",
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateDebate(), { wrapper });
    const data = await result.current.mutateAsync({
      claim: "test",
      max_rounds: 3,
    });
    expect(data.debate_id).toBe("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
  });

  it("P2 defaults max_rounds to 5", async () => {
    mockFetchOk({
      debate_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      stream_url: "/stream",
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateDebate(), { wrapper });
    await result.current.mutateAsync({ claim: "test" });
    // Verify body sent
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.max_rounds).toBe(5);
  });
});

/* ---------------------------------------------------------------
 * usePatchDebate
 * --------------------------------------------------------------- */

describe("usePatchDebate", () => {
  it("P1 merges partial update into existing cache entry", async () => {
    const { qc, wrapper } = createWrapper();
    const id = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    // Pre-populate cache
    const existing: Debate = {
      id,
      claim: "x",
      status: "running",
      verdict: null,
      confidence: null,
      rounds: [],
      transcript_md: null,
      created_at: "2026-04-10",
    };
    qc.setQueryData(debateKey(id), existing);

    const { result } = renderHook(() => usePatchDebate(id), { wrapper });
    result.current({ verdict: "TRUE", confidence: 0.9 });

    const updated = qc.getQueryData<Debate>(debateKey(id));
    expect(updated).toBeDefined();
    expect(updated?.verdict).toBe("TRUE");
    expect(updated?.confidence).toBe(0.9);
    // Unchanged fields preserved
    expect(updated?.claim).toBe("x");
  });

  it("F1 no-ops when cache is empty", () => {
    const { qc, wrapper } = createWrapper();
    const id = "some-id";
    const { result } = renderHook(() => usePatchDebate(id), { wrapper });
    result.current({ verdict: "TRUE" });
    // No crash, no data created
    expect(qc.getQueryData(debateKey(id))).toBeUndefined();
  });
});

/* ---------------------------------------------------------------
 * useInvalidateDebate
 * --------------------------------------------------------------- */

describe("useInvalidateDebate", () => {
  it("P1 invalidates the query for the given id", async () => {
    const { qc, wrapper } = createWrapper();
    const id = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useInvalidateDebate(id), { wrapper });
    result.current();

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["debate", id],
    });
  });
});
