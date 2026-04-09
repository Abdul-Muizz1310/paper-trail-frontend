"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type ClaimInputProps = {
  onSubmit: (claim: string, maxRounds: number) => Promise<void> | void;
  isPending: boolean;
  error?: string | null;
  defaultClaim?: string;
};

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

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <Label htmlFor="claim" className="text-sm font-medium">
        Claim
      </Label>
      <textarea
        id="claim"
        aria-label="claim"
        value={claim}
        onChange={(e) => setClaim(e.target.value)}
        disabled={isPending}
        rows={3}
        placeholder="e.g. Remote work reduces software engineering productivity."
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {visibleError && (
        <div role="alert" className="text-sm text-destructive">
          {visibleError}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Starting…" : "Start debate"}
        </Button>
      </div>
    </form>
  );
}
