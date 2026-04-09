"use client";

import { useState } from "react";

export type ClaimInputProps = {
  onSubmit: (claim: string, maxRounds: number) => Promise<void> | void;
  isPending: boolean;
  error?: string | null;
  defaultClaim?: string;
};

/**
 * Styled as a code-editor block: line number gutter, monospaced textarea,
 * `$ start-debate` submit pill. Matches the reference's hero vibe.
 */
export function ClaimInput({ onSubmit, isPending, error, defaultClaim }: ClaimInputProps) {
  const [claim, setClaim] = useState(defaultClaim ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const visibleError = error ?? localError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = claim.trim();
    if (trimmed.length === 0) {
      setLocalError("Enter a claim to debate.");
      return;
    }
    if (trimmed.length > 2000) {
      setLocalError("Claim must be ≤ 2000 characters.");
      return;
    }
    setLocalError(null);
    await onSubmit(trimmed, 5);
  };

  // Fake line-number gutter: count newlines + 1, minimum 3 lines for visual balance
  const lineCount = Math.max(3, claim.split("\n").length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      {/* Editor block */}
      <label htmlFor="claim" className="sr-only">
        claim
      </label>
      <div className="group relative overflow-hidden rounded-xl border border-border bg-background/60 transition-colors focus-within:border-accent-cyan/60 focus-within:shadow-[0_0_0_1px_rgb(34_211_238_/_0.3),0_0_30px_rgb(34_211_238_/_0.15)]">
        <div className="flex items-center gap-2 border-b border-border bg-surface/50 px-3 py-2 font-mono text-[11px] text-fg-faint">
          <span className="inline-block h-2 w-2 rounded-full bg-mac-red/80" />
          <span className="inline-block h-2 w-2 rounded-full bg-mac-yellow/80" />
          <span className="inline-block h-2 w-2 rounded-full bg-mac-green/80" />
          <span className="ml-2 text-accent-cyan">claim.txt</span>
        </div>
        <div className="flex">
          {/* Line number gutter */}
          <div
            aria-hidden
            className="select-none border-r border-border bg-background/40 px-3 py-4 text-right font-mono text-xs leading-6 text-fg-faint"
          >
            {lineNumbers.map((n) => (
              <div key={n} className="tabular-nums">
                {String(n).padStart(2, "0")}
              </div>
            ))}
          </div>
          <textarea
            id="claim"
            aria-label="claim"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            disabled={isPending}
            rows={3}
            placeholder="// e.g. Remote work reduces software engineering productivity."
            className="flex-1 resize-none bg-transparent px-4 py-4 font-mono text-sm leading-6 text-foreground caret-accent-cyan placeholder:text-fg-faint focus:outline-none disabled:opacity-60"
          />
        </div>
      </div>

      {visibleError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 font-mono text-xs text-error"
        >
          <span>⨯</span>
          <span>{visibleError}</span>
        </div>
      )}

      {/* Submit row */}
      <div className="flex items-center justify-between gap-4">
        <div className="font-mono text-xs text-fg-faint">
          <span className="text-fg-faint">max-rounds:</span>{" "}
          <span className="text-fg-muted">5</span>
          <span className="mx-2 text-fg-faint">·</span>
          <span className="text-fg-faint">model:</span>{" "}
          <span className="text-accent-cyan">openrouter</span>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-accent-cyan to-accent-blue px-5 font-mono text-sm font-semibold text-background shadow-[0_0_30px_rgb(34_211_238_/_0.25)] transition-all hover:shadow-[0_0_40px_rgb(34_211_238_/_0.45)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-background/70">$</span>
          <span>{isPending ? "compiling…" : "start-debate"}</span>
          {!isPending && (
            <span className="text-background/70 transition-transform group-hover:translate-x-0.5">
              →
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
