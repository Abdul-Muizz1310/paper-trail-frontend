"use client";

import Link from "next/link";
import { TranscriptView } from "@/components/TranscriptView";
import { useDebate } from "@/lib/api";

type Props = { debateId: string };

export function TranscriptClient({ debateId }: Props) {
  const query = useDebate(debateId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Link
          href={`/debates/${debateId}`}
          className="hover:text-foreground hover:underline underline-offset-4"
        >
          ← Back to debate
        </Link>
        <span>Transcript</span>
      </div>

      {query.isPending && (
        <div
          data-testid="transcript-loading"
          className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
        >
          Loading transcript…
        </div>
      )}

      {query.isError && (
        <div
          data-testid="transcript-error"
          role="status"
          className="flex flex-col items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          <span>Couldn't load this transcript.</span>
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            Go home
          </Link>
        </div>
      )}

      {query.data && <TranscriptView markdown={query.data.transcript_md ?? ""} />}
    </main>
  );
}
