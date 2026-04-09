"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DebateArena, type DebatePhase } from "@/components/DebateArena";
import { JudgeVerdict } from "@/components/JudgeVerdict";
import { useDebate, useInvalidateDebate } from "@/lib/api";
import type { Round, Verdict } from "@/lib/schemas";
import { useDebateStream } from "@/lib/sse";

type Props = { debateId: string };

function splitRounds(rounds: Round[]): { pro: Round[]; con: Round[]; judge?: Round } {
  const pro: Round[] = [];
  const con: Round[] = [];
  let judge: Round | undefined;
  for (const r of rounds) {
    if (r.side === "pro") pro.push(r);
    else if (r.side === "con") con.push(r);
    else judge = r;
  }
  return { pro, con, judge };
}

export function DebateView({ debateId }: Props) {
  const debateQuery = useDebate(debateId);
  const invalidate = useInvalidateDebate(debateId);
  const { phase: streamPhase } = useDebateStream(debateId, {
    onStateChange: () => {
      void invalidate();
    },
  });

  // If the SSE reports a terminal `done`, still refetch once so the final
  // rounds + transcript are in the query cache.
  useEffect(() => {
    if (streamPhase.kind === "done") {
      void invalidate();
    }
  }, [streamPhase.kind, invalidate]);

  if (debateQuery.isPending) {
    return <DebateArena pro={[]} con={[]} phase="loading" />;
  }

  if (debateQuery.isError) {
    return (
      <div className="flex flex-col items-start gap-4">
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          Couldn't load this debate.
        </div>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  const debate = debateQuery.data;
  const { pro, con, judge } = splitRounds(debate.rounds);

  const isTerminal =
    debate.status === "done" ||
    debate.status === "failed" ||
    debate.status === "error" ||
    streamPhase.kind === "done" ||
    streamPhase.kind === "error";

  const arenaPhase: DebatePhase =
    streamPhase.kind === "error" ? "error" : isTerminal ? "done" : "streaming";

  const showVerdict = isTerminal && debate.verdict !== null && debate.confidence !== null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Claim</div>
        <h1 className="text-xl font-medium md:text-2xl">{debate.claim}</h1>
        <div className="text-xs text-muted-foreground">
          Status: <span className="font-mono">{debate.status}</span>
          {streamPhase.kind === "connecting" && " · reconnecting…"}
        </div>
      </header>

      <DebateArena
        pro={pro}
        con={con}
        phase={arenaPhase}
        errorMessage={
          streamPhase.kind === "error"
            ? streamPhase.reason === "not_found"
              ? "This debate no longer exists."
              : "Connection failed."
            : undefined
        }
      />

      {showVerdict && debate.verdict && debate.confidence !== null && (
        <JudgeVerdict
          verdict={debate.verdict as Verdict}
          confidence={debate.confidence}
          reasoning={judge?.body_md}
        />
      )}

      {isTerminal && (
        <div>
          <Link
            href={`/debates/${debateId}/transcript`}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            View transcript →
          </Link>
        </div>
      )}
    </div>
  );
}
