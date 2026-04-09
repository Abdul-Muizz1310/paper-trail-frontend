"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/lib/env";
import { type Debate, DebateCreateOutSchema, DebateSchema } from "@/lib/schemas";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function jsonFetch(path: string, init?: RequestInit): Promise<unknown> {
  // NOTE: only set content-type when we have a body. Adding it to a
  // cross-origin GET turns it into a non-simple request and forces a
  // CORS preflight, which the backend rejects for test/mocked setups.
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new ApiError(res.status, `${init?.method ?? "GET"} ${path} → ${res.status}`);
  }
  return res.json();
}

/* ----------------------- Debates ----------------------- */

export function debateKey(id: string) {
  return ["debate", id] as const;
}

export function useDebate(id: string, enabled = true) {
  return useQuery<Debate>({
    queryKey: debateKey(id),
    queryFn: async () => {
      const raw = await jsonFetch(`/debates/${id}`);
      return DebateSchema.parse(raw);
    },
    enabled,
    // Every invalidate() should actually refetch — no stale caching
    // while the debate is running.
    staleTime: 0,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export type CreateDebateArgs = { claim: string; max_rounds?: number };

export function useCreateDebate() {
  return useMutation({
    mutationFn: async ({ claim, max_rounds = 5 }: CreateDebateArgs) => {
      const raw = await jsonFetch("/debates", {
        method: "POST",
        body: JSON.stringify({ claim, max_rounds }),
      });
      return DebateCreateOutSchema.parse(raw);
    },
  });
}

/**
 * Helper used by the debate page to refresh the full debate snapshot
 * when the SSE reports a new rounds_count.
 */
export function useInvalidateDebate(id: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: debateKey(id) });
}

/**
 * Merge a partial snapshot (from an SSE state event that inlined the
 * rounds) into the query cache without a round-trip. Only applies if
 * the current cache already has a full Debate object to merge into.
 */
export function usePatchDebate(id: string) {
  const qc = useQueryClient();
  return (patch: Partial<Debate>) => {
    qc.setQueryData<Debate>(debateKey(id), (prev) => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
  };
}

export { ApiError };
