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
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
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
    staleTime: 0,
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

export { ApiError };
