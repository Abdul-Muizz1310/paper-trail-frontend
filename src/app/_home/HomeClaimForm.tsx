"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ClaimInput } from "@/components/ClaimInput";
import { ApiError, TIMEOUT_STATUS, useCreateDebate } from "@/lib/api";

/**
 * Minimum gap between accepted submissions. Each submit spawns a real
 * multi-agent LLM debate, so we add client-side friction against a user
 * (or script) hammering the only public entry point. Kept short so a
 * deliberate retry after a real error isn't blocked; the backend remains
 * the real trust boundary (and its 429s are surfaced below).
 */
const SUBMIT_COOLDOWN_MS = 1500;

/**
 * Where the last-accepted-submit timestamp is persisted. Keeping it in
 * sessionStorage (not just a ref) means the cooldown survives a page
 * reload, so the cheapest bypass of an in-memory guard — reload the tab
 * and immediately resubmit — is also throttled. This is still only
 * client-side friction (a non-browser script bypasses it entirely); the
 * backend rate limit on POST /debates remains the real trust boundary.
 */
const COOLDOWN_STORAGE_KEY = "paper-trail:last-submit-at";

/**
 * Read the persisted last-submit timestamp. Fails open to 0 (no cooldown)
 * when sessionStorage is unavailable (SSR, private mode, storage disabled)
 * or holds a malformed value — the in-flight `isPending` guard still
 * prevents concurrent submits regardless.
 */
function readLastSubmitAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (raw === null) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/** Persist the last-submit timestamp; best-effort (storage may be blocked). */
function writeLastSubmitAt(ts: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(COOLDOWN_STORAGE_KEY, String(ts));
  } catch {
    // Ignore — the in-memory ref still enforces the cooldown this session.
  }
}

/** Map a create-debate failure to user-facing copy. */
function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "You're starting debates too quickly. Please wait a moment and try again.";
    }
    if (error.status === TIMEOUT_STATUS) {
      return "The backend took too long to respond — it may be waking up. Please try again.";
    }
  }
  return "Couldn't start the debate. Try again.";
}

export function HomeClaimForm() {
  const router = useRouter();
  const [lastClaim, setLastClaim] = useState<string | undefined>();
  // Timestamp of the last accepted submit — used purely as a debounce
  // guard (kept in a ref so it never triggers a re-render / disables the
  // UI). `null` means "not yet read this mount"; on first use we hydrate
  // it from sessionStorage so the cooldown carries across page reloads.
  const lastSubmitAt = useRef<number | null>(null);
  const mutation = useCreateDebate();

  const handleSubmit = async (claim: string, maxRounds: number) => {
    // Friction: drop a submit fired while one is in flight or within the
    // cooldown window of the previous accepted submit (including one made
    // before a reload — hence the sessionStorage-backed fallback).
    const now = Date.now();
    const last = lastSubmitAt.current ?? readLastSubmitAt();
    if (mutation.isPending || now - last < SUBMIT_COOLDOWN_MS) return;
    lastSubmitAt.current = now;
    writeLastSubmitAt(now);
    setLastClaim(claim);
    try {
      const result = await mutation.mutateAsync({
        claim,
        max_rounds: maxRounds,
      });
      router.push(`/debates/${result.debate_id}`);
    } catch {
      // Error surfaces via the `error` prop below; claim is preserved in
      // `defaultClaim` so the user never loses what they typed.
    }
  };

  return (
    <ClaimInput
      onSubmit={handleSubmit}
      isPending={mutation.isPending}
      error={mutation.isError ? describeError(mutation.error) : null}
      defaultClaim={mutation.isError ? lastClaim : undefined}
    />
  );
}
