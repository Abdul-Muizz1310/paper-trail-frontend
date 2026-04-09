"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClaimInput } from "@/components/ClaimInput";
import { useCreateDebate } from "@/lib/api";

export function HomeClaimForm() {
  const router = useRouter();
  const [lastClaim, setLastClaim] = useState<string | undefined>();
  const mutation = useCreateDebate();

  const handleSubmit = async (claim: string, maxRounds: number) => {
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
      error={mutation.isError ? "Couldn't start the debate. Try again." : null}
      defaultClaim={mutation.isError ? lastClaim : undefined}
    />
  );
}
